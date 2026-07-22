'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { addBreadcrumb, captureException, captureMessage } from '@sentry/nextjs'
import { getOneSignalAdapter, type NotificationPermissionState } from '@/services/onesignal'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import { isDemoMode } from '@/utils/demo'
import { useUserStore } from '@/redux/hooks'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import { UTM_SOURCES, UTM_MEDIUMS } from '@/utils/utm.utils'

/*
 * Notification state lives in a module-level store shared by every
 * useNotifications() consumer. The hook used to keep per-instance useState and
 * register adapter callbacks behind a window flag, so only the first-mounted
 * instance ever received permission/subscription events — and if it unmounted,
 * the callbacks pointed at a dead component forever. The store initializes
 * OneSignal once and fans events out to all subscribed instances.
 */
interface NotificationsState {
    permissionState: NotificationPermissionState
    isPushOptedIn: boolean
    sdkReady: boolean
    oneSignalInitialized: boolean
    showPermissionModal: boolean
    isRequestingPermission: boolean
}

const INITIAL_STATE: NotificationsState = {
    permissionState: 'default',
    isPushOptedIn: false,
    sdkReady: false,
    oneSignalInitialized: false,
    showPermissionModal: false,
    isRequestingPermission: false,
}

let state: NotificationsState = INITIAL_STATE
const storeSubscribers = new Set<() => void>()

function setState(partial: Partial<NotificationsState>) {
    state = { ...state, ...partial }
    storeSubscribers.forEach((notify) => notify())
}

function subscribe(notify: () => void): () => void {
    storeSubscribers.add(notify)
    return () => storeSubscribers.delete(notify)
}

const getSnapshot = () => state
const getServerSnapshot = () => INITIAL_STATE

let currentExternalId: string | null = null
let lastLinkedExternalId: string | null = null
let disableExternalIdLogin = false
let hasTrackedModalShown = false
let initStarted = false

function handleLoginError(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err ?? '')
    // disable login on identity verification errors
    if (msg.toLowerCase().includes('identity') || msg.toLowerCase().includes('verify')) {
        if (disableExternalIdLogin) return
        disableExternalIdLogin = true
        console.warn('OneSignal external_id login disabled due to identity verification error')
        // silently disabling login unlinks the device from the user, so pushes target no one
        captureMessage('OneSignal external_id login disabled after identity verification error', {
            level: 'warning',
            tags: { feature: 'onesignal', onesignal: 'login-disabled' },
            extra: { error: msg },
        })
    }
    /*
     * A failed login() means the device subscription never gets the external_id
     * the backend targets by — pushes silently reach zero recipients. Keep this
     * loud in Sentry.
     */
    captureException(err, {
        tags: { source: 'onesignal_login' },
        extra: { disabledExternalIdLogin: disableExternalIdLogin },
    })
}

// link/unlink the OneSignal subscription to the logged-in user
async function syncExternalIdLink() {
    if (!state.oneSignalInitialized) return
    const id = currentExternalId
    if (id && lastLinkedExternalId !== id) {
        if (disableExternalIdLogin) return
        try {
            const adapter = await getOneSignalAdapter()
            await adapter.login(id)
            // commit only on success so transient failures retry on the next sync
            lastLinkedExternalId = id
        } catch (err: unknown) {
            handleLoginError(err)
        }
    } else if (!id && lastLinkedExternalId !== null) {
        lastLinkedExternalId = null
        try {
            const adapter = await getOneSignalAdapter()
            await adapter.logout()
        } catch (err) {
            addBreadcrumb({ category: 'onesignal', message: 'logout failed', data: { error: String(err) } })
        }
    }
}

// determine if permission modal should be shown (once per user)
async function evaluateVisibility() {
    if (!state.sdkReady || !state.oneSignalInitialized) return

    let granted = false
    let optedIn = false
    try {
        const adapter = await getOneSignalAdapter()
        granted = (await adapter.getPermission()) === 'granted'
        optedIn = await adapter.isOptedIn()
    } catch {
        return
    }
    setState({ isPushOptedIn: optedIn })

    // if permission is granted, hide modal
    if (granted) {
        setState({ showPermissionModal: false })
        return
    }

    const userPreferences = getUserPreferences(currentExternalId ?? undefined)
    const modalClosed = userPreferences?.notifModalClosed ?? false

    // don't show modal if permission is denied (carousel cta will handle it)
    if (state.permissionState === 'denied') {
        setState({ showPermissionModal: false })
        return
    }

    // if permission is default and user already opted in at onesignal level, hide modal
    if (optedIn) {
        setState({ showPermissionModal: false })
        return
    }

    // show modal only if user hasn't closed it yet
    if (!modalClosed) {
        setState({ showPermissionModal: true })
        if (!hasTrackedModalShown) {
            hasTrackedModalShown = true
            posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.NOTIFICATIONS })
        }
    } else {
        setState({ showPermissionModal: false })
    }
}

// initialize onesignal (web or native) via the platform adapter, once per page
async function ensureInitialized() {
    if (initStarted || typeof window === 'undefined') return
    // demo sessions are synthetic: no push subscription, no external_id login
    if (isDemoMode()) return
    initStarted = true

    if (typeof Notification !== 'undefined') {
        setState({ permissionState: Notification.permission as NotificationPermissionState })
    }

    try {
        const adapter = await getOneSignalAdapter()
        await adapter.init()

        adapter.onPermissionChange((permissionState) => {
            addBreadcrumb({ category: 'onesignal', message: 'permission change', data: { permissionState } })
            // update permission state and immediately re-evaluate ui visibility
            setState({ permissionState })
            evaluateVisibility()

            // track the resulting permission state
            if (permissionState === 'granted') {
                posthog.capture(ANALYTICS_EVENTS.NOTIFICATION_PERMISSION_GRANTED)
            } else if (permissionState === 'denied') {
                posthog.capture(ANALYTICS_EVENTS.NOTIFICATION_PERMISSION_DENIED)
            }
        })

        adapter.onSubscriptionChange(async (optedIn) => {
            addBreadcrumb({ category: 'onesignal', message: 'subscription change', data: { optedIn } })
            // link subscription to logged-in user if available
            if (currentExternalId && !disableExternalIdLogin) {
                try {
                    await adapter.login(currentExternalId)
                } catch (err: unknown) {
                    handleLoginError(err)
                }
            }

            // mirror OneSignal subscription state so consumers that gate on
            // `isPushOptedIn` (e.g. the home carousel CTA) react without
            // waiting for the next permissionChange event.
            setState({ isPushOptedIn: optedIn })

            // hide modal when user opts in
            if (optedIn) {
                posthog.capture(ANALYTICS_EVENTS.NOTIFICATION_SUBSCRIBED)
                setState({ showPermissionModal: false })
            }
        })

        // Notification tap → PostHog. OneSignal delivers push clicks to its own
        // SDK worker (bypassing our sw.ts handler), so this is the only client-side
        // hook that sees the tap. Firing an explicit event (with the campaign carried
        // in additionalData) makes blast clicks attributable even when the tap merely
        // focuses an already-open PWA tab and no `$pageview` — hence no utm capture —
        // fires. Marketing sends set `data.campaign`; transactional taps have none.
        adapter.onNotificationClick(({ deepLink, additionalData }) => {
            const campaign = typeof additionalData.campaign === 'string' ? additionalData.campaign : undefined
            const props: Record<string, unknown> = { deep_link: deepLink }
            if (campaign) {
                props.utm_source = UTM_SOURCES.ONESIGNAL
                props.utm_medium = UTM_MEDIUMS.PUSH
                props.utm_campaign = campaign
                if (typeof additionalData.utmContent === 'string') props.utm_content = additionalData.utmContent
            }
            posthog.capture(ANALYTICS_EVENTS.NOTIFICATION_CLICKED, props)
        })

        setState({ oneSignalInitialized: true, sdkReady: true })
        await syncExternalIdLink()
        await evaluateVisibility()
    } catch (e) {
        // Surface Brave/Shields SDK-block failures; previously silent.
        console.warn('OneSignal init failed', e)
        captureException(e, { level: 'warning', tags: { feature: 'onesignal', source: 'onesignal_init' } })
    }
}

function setExternalId(externalId: string | null) {
    if (currentExternalId === externalId) return
    currentExternalId = externalId
    syncExternalIdLink()
    evaluateVisibility()
}

// update permission state from the platform adapter
async function refreshPermissionState() {
    if (typeof window === 'undefined') return
    try {
        const adapter = await getOneSignalAdapter()
        setState({ permissionState: await adapter.getPermission() })
        await evaluateVisibility()
    } catch {
        // adapter unavailable (e.g. SDK blocked) — leave state as-is
    }
}

// request notification permission from user
async function requestPermission(): Promise<NotificationPermissionState> {
    if (typeof window === 'undefined' || !state.oneSignalInitialized) return 'default'

    setState({ isRequestingPermission: true })
    posthog.capture(ANALYTICS_EVENTS.NOTIFICATION_PERMISSION_REQUESTED)

    try {
        const adapter = await getOneSignalAdapter()
        const newPermission = await adapter.requestPermission()
        setState({ permissionState: newPermission })
        evaluateVisibility()
        return newPermission
    } catch (error) {
        console.warn('Error requesting permission:', error)
        captureException(error, { tags: { source: 'onesignal_request_permission' } })
        return 'default'
    } finally {
        setState({ isRequestingPermission: false })
    }
}

// close modal when user dismisses it
function closePermissionModal() {
    setState({ showPermissionModal: false })
    updateUserPreferences(currentExternalId ?? undefined, { notifModalClosed: true })
    posthog.capture(ANALYTICS_EVENTS.MODAL_DISMISSED, { modal_type: MODAL_TYPES.NOTIFICATIONS })
}

// update permission state after user interacts with permission prompt
async function afterPermissionAttempt() {
    // mark modal as closed to prevent it from showing again
    updateUserPreferences(currentExternalId ?? undefined, { notifModalClosed: true })
    await refreshPermissionState()
}

export function useNotifications() {
    const { user } = useUserStore()
    const externalId = user?.user.userId
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

    useEffect(() => {
        ensureInitialized()
    }, [])

    useEffect(() => {
        setExternalId(externalId ?? null)
    }, [externalId])

    return {
        showPermissionModal: snapshot.showPermissionModal,
        requestPermission,
        closePermissionModal,
        afterPermissionAttempt,
        permissionState: snapshot.permissionState,
        isPermissionDenied: snapshot.permissionState === 'denied',
        isPermissionGranted: snapshot.permissionState === 'granted',
        isPushOptedIn: snapshot.isPushOptedIn,
        isRequestingPermission: snapshot.isRequestingPermission,
        refreshPermissionState,
        oneSignalInitialized: snapshot.oneSignalInitialized,
    }
}
