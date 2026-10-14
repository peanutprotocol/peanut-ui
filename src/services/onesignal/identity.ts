import { getOneSignalAdapter, type OneSignalAdapter } from './index'
import { createPushIdentitySync } from './identity-sync'
import { captureException } from '@/utils/sentry-lazy'

let initialized: Promise<OneSignalAdapter> | null = null
let explicitlyLoggedOut = false
let logoutVersion: string | null = null
let logoutSequence = 0
let verificationRevision = 0
let authExternalId: string | null | undefined
const loginAvailableListeners = new Set<() => void>()
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
        const active = localStorage.getItem(LOGGED_OUT_KEY)
        if (active !== null) {
            explicitlyLoggedOut = true
            logoutVersion = active
        }
        return explicitlyLoggedOut
    } catch {
        return explicitlyLoggedOut
    }
}

function persistLogout(loggedOut: boolean) {
    verificationRevision += 1
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
    authExternalId = externalId
    return identity.setExternalId(externalId)
}

/** SDK callbacks may still hold the profile from before auth reconciliation. */
export const syncNotificationIdentityFromHook = (externalId: string | null): Promise<void> => {
    if (authExternalId !== undefined) return syncNotificationIdentity(authExternalId)
    return identity.setExternalId(isExplicitlyLoggedOut() ? null : externalId)
}

function readSharedLogoutState() {
    try {
        return {
            active: localStorage.getItem(LOGGED_OUT_KEY),
            version: localStorage.getItem(LOGOUT_VERSION_KEY) ?? logoutVersion,
        }
    } catch {
        return undefined
    }
}

export const PUSH_IDENTITY_VERIFICATION_TIMEOUT_MS = 10_000

/** A shared marker removal is a prompt to verify auth, never proof of login. */
export function onNotificationIdentityLoginAvailable(callback: () => void): () => void {
    loginAvailableListeners.add(callback)
    return () => {
        loginAvailableListeners.delete(callback)
    }
}

export async function reconcileNotificationIdentity(
    cachedExternalId: string | null,
    verifyExternalId: () => Promise<string | null>
): Promise<void> {
    if (!isExplicitlyLoggedOut()) return syncNotificationIdentity(cachedExternalId)
    const before = readSharedLogoutState()
    if (!before || before.active !== null) return syncNotificationIdentity(null)

    const revision = ++verificationRevision
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        const verifiedId = await Promise.race([
            Promise.resolve().then(verifyExternalId),
            new Promise<never>((_, reject) => {
                timeout = setTimeout(
                    () => reject(new Error('Push identity authentication verification timed out')),
                    PUSH_IDENTITY_VERIFICATION_TIMEOUT_MS
                )
            }),
        ])
        if (typeof verifiedId !== 'string' || !verifiedId.trim()) return
        const after = readSharedLogoutState()
        if (!after || after.active !== null || after.version !== before.version || revision !== verificationRevision)
            return
        // Clear only this document's latch. Never remove a newer shared logout.
        explicitlyLoggedOut = false
        await syncNotificationIdentity(verifiedId)
    } finally {
        clearTimeout(timeout)
    }
}

/** Only a newly authenticated login may release the explicit logout boundary. */
export function resumeNotificationIdentity(externalId: string): Promise<void> {
    persistLogout(false)
    authExternalId = externalId
    return identity.setExternalId(externalId)
}

export const PUSH_LOGOUT_TIMEOUT_MS = 3_000

/** Preserve the anonymous push subscription; do not revoke permission/opt out. */
export async function logoutNotificationIdentity(): Promise<void> {
    persistLogout(true)
    authExternalId = null
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
        if (event.key !== LOGGED_OUT_KEY) return
        if (event.newValue === null) {
            if (!event.oldValue || readSharedLogoutState()?.active !== null) return
            for (const listener of loginAvailableListeners) listener()
            return
        }
        // Storage events are queued: a trusted login may already have removed
        // this boundary before an older event is delivered.
        try {
            if (localStorage.getItem(LOGGED_OUT_KEY) !== event.newValue) return
        } catch {
            // Without readable shared state, do not accept an unverified event.
            return
        }
        explicitlyLoggedOut = true
        authExternalId = null
        verificationRevision += 1
        logoutVersion = event.newValue
        void identity.setExternalId(null).catch(() => {
            captureException(new Error('Push identity cross-tab logout failed'), {
                tags: { source: 'push_identity_storage' },
            })
        })
    })
}
