'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { captureException } from '@sentry/nextjs'
import { getOneSignalAdapter, type NotificationPermissionState } from '@/services/onesignal'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import { useUserStore } from '@/redux/hooks'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'

export function useNotifications() {
    const { user } = useUserStore()
    const externalId = user?.user.userId

    // refs to track current state without causing re-renders
    const externalIdRef = useRef<string | null>(null)
    const lastLinkedExternalIdRef = useRef<string | null>(null)
    const disableExternalIdLoginRef = useRef<boolean>(false)
    const hasTrackedModalShown = useRef(false)

    // ui state for permission modal (shown once on login)
    const [showPermissionModal, setShowPermissionModal] = useState(false)
    const [isRequestingPermission, setIsRequestingPermission] = useState(false)

    // track notification permission state
    const [permissionState, setPermissionState] = useState<NotificationPermissionState>(() => {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'default'
        return Notification.permission as NotificationPermissionState
    })

    // track onesignal initialization status
    const [sdkReady, setSdkReady] = useState(false)
    const [oneSignalInitialized, setOneSignalInitialized] = useState(false)

    // OneSignal subscription-level opt-in (looser than browser permission — a user can
    // have permission revoked at the browser but still appear opted-in in OneSignal,
    // or vice versa). Tracked as state so consumers (like the carousel notification CTA)
    // can hide themselves the moment EITHER signal confirms the user is signed up.
    const [isPushOptedIn, setIsPushOptedIn] = useState(false)

    // update permission state from the platform adapter
    const refreshPermissionState = useCallback(async () => {
        if (typeof window === 'undefined') return
        try {
            const adapter = await getOneSignalAdapter()
            setPermissionState(await adapter.getPermission())
        } catch {
            // adapter unavailable (e.g. SDK blocked) — leave state as-is
        }
    }, [])

    // check if user has granted notification permission
    const getPermissionGranted = useCallback(async (): Promise<boolean> => {
        if (typeof window === 'undefined' || !oneSignalInitialized) return false
        try {
            const adapter = await getOneSignalAdapter()
            return (await adapter.getPermission()) === 'granted'
        } catch {
            return false
        }
    }, [oneSignalInitialized])

    // check if user has opted into push notifications
    // note: this checks the onesignal subscription state, not the browser permission
    const isPushSubscriptionOptedIn = useCallback(async (): Promise<boolean> => {
        if (typeof window === 'undefined' || !oneSignalInitialized) return false
        try {
            const adapter = await getOneSignalAdapter()
            return await adapter.isOptedIn()
        } catch {
            return false
        }
    }, [oneSignalInitialized])

    // determine if permission modal should be shown (once per user)
    const evaluateVisibility = useCallback(async () => {
        // wait for sdk to be ready before checking permissions
        if (!sdkReady || !oneSignalInitialized) return

        const granted = await getPermissionGranted()
        const optedIn = await isPushSubscriptionOptedIn()
        setIsPushOptedIn(optedIn)

        // if permission is granted, hide modal
        if (granted) {
            setShowPermissionModal(false)
            return
        }

        const userPreferences = getUserPreferences(user?.user.userId)
        const modalClosed = userPreferences?.notifModalClosed ?? false

        // don't show modal if permission is denied (carousel cta will handle it)
        if (permissionState === 'denied') {
            setShowPermissionModal(false)
            return
        }

        // if permission is default and user already opted in at onesignal level, hide modal
        if (optedIn) {
            setShowPermissionModal(false)
            return
        }

        // show modal only if user hasn't closed it yet
        if (!modalClosed) {
            setShowPermissionModal(true)
            if (!hasTrackedModalShown.current) {
                hasTrackedModalShown.current = true
                posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.NOTIFICATIONS })
            }
        } else {
            setShowPermissionModal(false)
        }
    }, [
        getPermissionGranted,
        isPushSubscriptionOptedIn,
        sdkReady,
        oneSignalInitialized,
        permissionState,
        user?.user.userId,
    ])

    // initialize onesignal (web or native) via the platform adapter
    useEffect(() => {
        if (typeof window === 'undefined' || oneSignalInitialized) return

        const w = window as Window & { __ONE_SIGNAL_LISTENERS_ADDED__?: boolean }
        let cancelled = false

        const bootstrap = async () => {
            try {
                const adapter = await getOneSignalAdapter()
                await adapter.init()
                if (cancelled) return

                // attach listeners once across hook instances
                if (!w.__ONE_SIGNAL_LISTENERS_ADDED__) {
                    w.__ONE_SIGNAL_LISTENERS_ADDED__ = true

                    adapter.onPermissionChange((state) => {
                        // update local permission state and immediately re-evaluate ui visibility
                        setPermissionState(state)
                        evaluateVisibility()

                        // track the resulting permission state
                        if (state === 'granted') {
                            posthog.capture(ANALYTICS_EVENTS.NOTIFICATION_PERMISSION_GRANTED)
                        } else if (state === 'denied') {
                            posthog.capture(ANALYTICS_EVENTS.NOTIFICATION_PERMISSION_DENIED)
                        }
                    })

                    adapter.onSubscriptionChange(async (optedIn) => {
                        // link subscription to logged-in user if available
                        const id = externalIdRef.current
                        if (id && !disableExternalIdLoginRef.current) {
                            try {
                                await adapter.login(id)
                            } catch (err: unknown) {
                                const msg = err instanceof Error ? err.message : String(err ?? '')
                                // disable login on identity verification errors
                                if (msg.toLowerCase().includes('identity') || msg.toLowerCase().includes('verify')) {
                                    disableExternalIdLoginRef.current = true
                                    console.warn(
                                        'OneSignal external_id login disabled due to identity verification error'
                                    )
                                }
                            }
                        }

                        // mirror OneSignal subscription state into local state so consumers
                        // that gate on `isPushOptedIn` (e.g. the home carousel CTA) react
                        // without waiting for the next permissionChange event.
                        setIsPushOptedIn(optedIn)

                        // hide modal when user opts in
                        if (optedIn) {
                            posthog.capture(ANALYTICS_EVENTS.NOTIFICATION_SUBSCRIBED)
                            setShowPermissionModal(false)
                        }
                    })
                }

                setOneSignalInitialized(true)
                setSdkReady(true)
            } catch (e) {
                // Surface Brave/Shields SDK-block failures; previously silent.
                console.warn('OneSignal init failed', e)
                captureException(e, { tags: { source: 'onesignal_init' } })
            }
        }

        bootstrap()

        return () => {
            cancelled = true
        }
    }, [oneSignalInitialized, evaluateVisibility])

    // request notification permission from user
    const requestPermission = useCallback(async (): Promise<NotificationPermissionState> => {
        if (typeof window === 'undefined' || !oneSignalInitialized) return 'default'

        setIsRequestingPermission(true)
        posthog.capture(ANALYTICS_EVENTS.NOTIFICATION_PERMISSION_REQUESTED)

        try {
            const adapter = await getOneSignalAdapter()
            const newPermission = await adapter.requestPermission()
            setPermissionState(newPermission)
            return newPermission
        } catch (error) {
            console.warn('Error requesting permission:', error)
            captureException(error, { tags: { source: 'onesignal_request_permission' } })
            return 'default'
        } finally {
            setIsRequestingPermission(false)
        }
    }, [oneSignalInitialized])

    // re-check visibility when sdk becomes ready
    useEffect(() => {
        if (sdkReady && oneSignalInitialized) {
            evaluateVisibility()
        }
    }, [sdkReady, oneSignalInitialized, evaluateVisibility])

    // keep ref in sync with latest user id for event listeners
    useEffect(() => {
        externalIdRef.current = externalId ?? null
    }, [externalId])

    // link/unlink user to onesignal when they log in/out
    useEffect(() => {
        if (typeof window === 'undefined' || !oneSignalInitialized) return

        // link user when they log in
        if (externalId && lastLinkedExternalIdRef.current !== externalId) {
            lastLinkedExternalIdRef.current = externalId

            const loginUser = async () => {
                try {
                    if (!disableExternalIdLoginRef.current) {
                        const adapter = await getOneSignalAdapter()
                        await adapter.login(externalId)
                    }
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err ?? '')
                    // disable on identity errors
                    if (msg.toLowerCase().includes('identity') || msg.toLowerCase().includes('verify')) {
                        disableExternalIdLoginRef.current = true
                        console.warn('OneSignal external_id login disabled due to identity verification error')
                    }
                }
            }

            loginUser()
        }
        // unlink user when they log out
        else if (!externalId && lastLinkedExternalIdRef.current !== null) {
            lastLinkedExternalIdRef.current = null

            const logoutUser = async () => {
                try {
                    const adapter = await getOneSignalAdapter()
                    await adapter.logout()
                } catch (_) {}
            }

            logoutUser()
        }
    }, [externalId, oneSignalInitialized])

    // close modal when user dismisses it
    const closePermissionModal = useCallback(() => {
        setShowPermissionModal(false)
        updateUserPreferences(user?.user.userId, { notifModalClosed: true })
        posthog.capture(ANALYTICS_EVENTS.MODAL_DISMISSED, { modal_type: MODAL_TYPES.NOTIFICATIONS })
    }, [user?.user.userId])

    // update permission state after user interacts with permission prompt
    const afterPermissionAttempt = useCallback(async () => {
        // mark modal as closed to prevent it from showing again
        updateUserPreferences(user?.user.userId, { notifModalClosed: true })
        // refresh permission state
        await refreshPermissionState()
    }, [user?.user.userId, refreshPermissionState])

    return {
        showPermissionModal,
        requestPermission,
        closePermissionModal,
        afterPermissionAttempt,
        permissionState,
        isPermissionDenied: permissionState === 'denied',
        isPermissionGranted: permissionState === 'granted',
        isPushOptedIn,
        isRequestingPermission,
        refreshPermissionState,
        oneSignalInitialized,
    }
}
