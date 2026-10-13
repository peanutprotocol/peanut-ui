import { getOneSignalAdapter, type OneSignalAdapter } from './index'
import { createPushIdentitySync } from './identity-sync'
import { captureException } from '@/utils/sentry-lazy'

let initialized: Promise<OneSignalAdapter> | null = null
let explicitlyLoggedOut = false
let logoutVersion: string | null = null
let logoutSequence = 0
// No account/token data: this is only a shared, durable logout boundary.
const LOGGED_OUT_KEY = 'peanut:push-logged-out'
const LOGOUT_VERSION_KEY = 'peanut:push-logout-version'

export function getNotificationLogoutVersion(): string | null {
    try {
        return localStorage.getItem(LOGOUT_VERSION_KEY) ?? localStorage.getItem(LOGGED_OUT_KEY) ?? logoutVersion
    } catch {
        return logoutVersion
    }
}

function isExplicitlyLoggedOut(): boolean {
    try {
        return explicitlyLoggedOut || localStorage.getItem(LOGGED_OUT_KEY) !== null
    } catch {
        return explicitlyLoggedOut
    }
}

function persistLogout(loggedOut: boolean) {
    explicitlyLoggedOut = loggedOut
    if (loggedOut) {
        logoutVersion =
            globalThis.crypto?.randomUUID?.() ??
            `${Date.now()}-${++logoutSequence}-${Math.random().toString(36).slice(2)}`
    }
    try {
        if (loggedOut && logoutVersion) {
            // Retain the last receipt separately: clearing active logout on
            // login must not hide an intervening logout from pending work.
            localStorage.setItem(LOGOUT_VERSION_KEY, logoutVersion)
            localStorage.setItem(LOGGED_OUT_KEY, logoutVersion)
        } else localStorage.removeItem(LOGGED_OUT_KEY)
    } catch {
        // In-memory cleanup still works when browser storage is unavailable.
        captureException(new Error('Push logout boundary persistence unavailable'), {
            tags: { source: 'push_identity_storage' },
        })
    }
}

/** Shared with the notification UI so auth cleanup works even without that UI. */
export function initializeNotificationIdentity(): Promise<OneSignalAdapter> {
    if (!initialized) {
        const loading = getOneSignalAdapter().then(async (adapter) => {
            await adapter.init()
            return adapter
        })
        initialized = loading
        loading.catch(() => {
            if (initialized === loading) initialized = null
        })
    }
    return initialized
}

const identity = createPushIdentitySync(
    async () => {
        const adapter = await initializeNotificationIdentity()
        return {
            init: async () => {},
            login: (id: string) => adapter.login(id),
            logout: () => adapter.logout(),
        }
    },
    {
        onTimeout: () => {
            initialized = null
        },
        onReconcileError: () => {
            captureException(new Error('Push identity late-operation reconciliation failed'), {
                tags: { source: 'push_identity_reconcile' },
            })
        },
    }
)

export const syncNotificationIdentity = (externalId: string | null): Promise<void> => {
    // SDK events can still carry the former hook identity during auth teardown.
    if (isExplicitlyLoggedOut() && externalId) return identity.setExternalId(null)
    return identity.setExternalId(externalId)
}

/** Only a newly authenticated login may release the explicit logout boundary. */
export function resumeNotificationIdentity(externalId: string): Promise<void> {
    persistLogout(false)
    return identity.setExternalId(externalId)
}

export const PUSH_LOGOUT_TIMEOUT_MS = 3_000

/** Preserve the anonymous push subscription; do not revoke permission/opt out. */
export async function logoutNotificationIdentity(): Promise<void> {
    persistLogout(true)
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        await Promise.race([
            syncNotificationIdentity(null),
            new Promise<never>((_, reject) => {
                timeout = setTimeout(() => {
                    identity.expirePending()
                    reject(new Error('Push identity logout timed out'))
                }, PUSH_LOGOUT_TIMEOUT_MS)
            }),
        ])
    } finally {
        clearTimeout(timeout)
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key !== LOGGED_OUT_KEY || !event.newValue) return
        // Storage events are queued: a trusted login may already have removed
        // this boundary before an older event is delivered.
        try {
            if (localStorage.getItem(LOGGED_OUT_KEY) !== event.newValue) return
        } catch {
            // Without readable shared state, do not accept an unverified event.
            return
        }
        explicitlyLoggedOut = true
        logoutVersion = event.newValue
        void identity.setExternalId(null).catch(() => {
            captureException(new Error('Push identity cross-tab logout failed'), {
                tags: { source: 'push_identity_storage' },
            })
        })
    })
}
