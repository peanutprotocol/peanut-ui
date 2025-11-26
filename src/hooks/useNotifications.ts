'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import OneSignal from 'react-onesignal'
import { getUserPreferences, updateUserPreferences } from '@/utils'
import { useUserStore } from '@/redux/hooks'

export function useNotifications() {
    const { user } = useUserStore()
    const externalId = user?.user.userId

    // refs to track current state without causing re-renders
    const externalIdRef = useRef<string | null>(null)
    const lastLinkedExternalIdRef = useRef<string | null>(null)
    const disableExternalIdLoginRef = useRef<boolean>(false)

    // ui state for permission modal (shown once on login)
    const [showPermissionModal, setShowPermissionModal] = useState(false)
    const [isRequestingPermission, setIsRequestingPermission] = useState(false)

    // track notification permission state
    const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied'>(() => {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'default'
        return Notification.permission as 'default' | 'granted' | 'denied'
    })

    // track onesignal initialization status
    const [sdkReady, setSdkReady] = useState(false)
    const [oneSignalInitialized, setOneSignalInitialized] = useState(false)

    // update permission state from browser api
    const refreshPermissionState = useCallback(() => {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') return
        setPermissionState(Notification.permission as 'default' | 'granted' | 'denied')
    }, [])

    // check if user has granted notification permission
    const getPermissionGranted = useCallback((): Promise<boolean> => {
        return new Promise((resolve) => {
            if (typeof window === 'undefined') return resolve(false)

            // use native permission api when available for reliability
            if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
                return resolve(Notification.permission === 'granted')
            }

            if (!oneSignalInitialized) return resolve(false)

            try {
                // fallback to onesignal permission check
                const perm = OneSignal?.Notifications?.permission
                resolve(perm === true)
            } catch {
                resolve(false)
            }
        })
    }, [oneSignalInitialized])

    // check if user has opted into push notifications
    // note: this checks the onesignal subscription state, not the browser permission
    const isPushSubscriptionOptedIn = useCallback((): Promise<boolean> => {
        return new Promise((resolve) => {
            if (typeof window === 'undefined' || !oneSignalInitialized) return resolve(false)

            try {
                resolve(Boolean(OneSignal.User?.PushSubscription?.optedIn))
            } catch {
                resolve(false)
            }
        })
    }, [oneSignalInitialized])

    // determine if permission modal should be shown (once per user)
    const evaluateVisibility = useCallback(async () => {
        // wait for sdk to be ready before checking permissions
        if (!sdkReady || !oneSignalInitialized) return

        const granted = await getPermissionGranted()
        const optedIn = await isPushSubscriptionOptedIn()

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

    // initialize onesignal sdk
    useEffect(() => {
        if (typeof window === 'undefined' || oneSignalInitialized) return

        const w = window as any

        const bootstrap = async () => {
            try {
                // fast-path if already initialized
                if (w.__ONE_SIGNAL_INIT_DONE__) {
                    setOneSignalInitialized(true)
                    setSdkReady(true)
                    return
                }

                // reuse single in-flight init across hook instances
                if (w.__ONE_SIGNAL_INIT_PROMISE__) {
                    await w.__ONE_SIGNAL_INIT_PROMISE__
                } else {
                    w.__ONE_SIGNAL_INIT_PROMISE__ = (async () => {
                        const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
                        const safariWebId = process.env.NEXT_PUBLIC_SAFARI_WEB_ID
                        const webhookUrl = process.env.NEXT_PUBLIC_ONESIGNAL_WEBHOOK!

                        if (!appId || !safariWebId) {
                            console.error(
                                'OneSignal configuration missing: NEXT_PUBLIC_ONESIGNAL_APP_ID and NEXT_PUBLIC_SAFARI_WEB_ID are required'
                            )
                            return
                        }

                        await OneSignal.init({
                            appId: appId,
                            safari_web_id: safariWebId,
                            // disable automatic prompts - we handle them manually
                            autoResubscribe: false,
                            autoRegister: false,
                            serviceWorkerParam: { scope: '/onesignal/' },
                            serviceWorkerPath: 'onesignal/OneSignalSDKWorker.js',
                            allowLocalhostAsSecureOrigin: true,
                            // prevent auto-prompts
                            promptOptions: {
                                slidedown: {
                                    prompts: [{ type: 'push', autoPrompt: false, categories: [], delay: {} }],
                                },
                            },
                            webhooks: {
                                cors: true,
                                // note: webhook endpoint is protected server-side via a shared token in additionaldata.authtoken
                                // this prevents random generated webhook calls, onesignal dashboard sends pass through additionaldata
                                'notification.willDisplay': webhookUrl,
                                'notification.clicked': webhookUrl,
                            },
                        })
                        w.__ONE_SIGNAL_READY__ = true
                        w.__ONE_SIGNAL_INIT_DONE__ = true
                    })()

                    try {
                        await w.__ONE_SIGNAL_INIT_PROMISE__
                    } finally {
                        // avoid holding the promise forever
                        delete w.__ONE_SIGNAL_INIT_PROMISE__
                    }
                }

                // attach listeners once across hook instances
                if (!w.__ONE_SIGNAL_LISTENERS_ADDED__) {
                    OneSignal.Notifications.addEventListener('permissionChange', () => {
                        // update local permission state and immediately re-evaluate ui visibility
                        refreshPermissionState()
                        evaluateVisibility()
                    })

                    type PushSubscriptionChangeEvent = { current?: { optedIn?: boolean } | null }
                    OneSignal.User.PushSubscription.addEventListener(
                        'change',
                        async (event: PushSubscriptionChangeEvent) => {
                            // link subscription to logged-in user if available
                            const id = externalIdRef.current
                            if (id && !disableExternalIdLoginRef.current) {
                                try {
                                    await OneSignal.login(id)
                                } catch (err: any) {
                                    const msg = (err && (err.message || err.toString())) || ''
                                    // disable login on identity verification errors
                                    if (
                                        msg.toLowerCase().includes('identity') ||
                                        msg.toLowerCase().includes('verify')
                                    ) {
                                        disableExternalIdLoginRef.current = true
                                        console.warn(
                                            'OneSignal external_id login disabled due to identity verification error'
                                        )
                                    }
                                }
                            }

                            // hide modal when user opts in
                            if (event.current?.optedIn) {
                                setShowPermissionModal(false)
                            }
                        }
                    )

                    w.__ONE_SIGNAL_LISTENERS_ADDED__ = true
                }

                setOneSignalInitialized(true)
                setSdkReady(true)
            } catch (e) {
                console.warn('OneSignal init failed', e)
            }
        }

        bootstrap()
    }, [oneSignalInitialized, evaluateVisibility, refreshPermissionState])

    // request notification permission from user
    const requestPermission = useCallback(async (): Promise<'granted' | 'denied' | 'default'> => {
        if (typeof window === 'undefined' || !oneSignalInitialized) return 'default'

        setIsRequestingPermission(true)

        try {
            // always use the native browser permission dialog, avoid onesignal slidedown ui
            // optIn may trigger the native prompt on supported browsers, but we explicitly request permission
            if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                await OneSignal.Notifications.requestPermission()
            }
        } catch (error) {
            console.warn('Error requesting permission:', error)
        } finally {
            setIsRequestingPermission(false)
        }

        // update permission state after request
        if (typeof Notification !== 'undefined') {
            const newPermission = Notification.permission as 'default' | 'granted' | 'denied'
            setPermissionState(newPermission)
            return newPermission
        }

        return 'default'
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
                        await OneSignal.login(externalId)
                    }
                } catch (err: any) {
                    const msg = (err && (err.message || err.toString())) || ''
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
                    await OneSignal.logout()
                } catch (_) {}
            }

            logoutUser()
        }
    }, [externalId, oneSignalInitialized])

    // close modal when user dismisses it
    const closePermissionModal = useCallback(() => {
        setShowPermissionModal(false)
        updateUserPreferences(user?.user.userId, { notifModalClosed: true })
    }, [user?.user.userId])

    // update permission state after user interacts with permission prompt
    const afterPermissionAttempt = useCallback(async () => {
        // mark modal as closed to prevent it from showing again
        updateUserPreferences(user?.user.userId, { notifModalClosed: true })
        // refresh permission state
        refreshPermissionState()
    }, [user?.user.userId, refreshPermissionState])

    return {
        showPermissionModal,
        requestPermission,
        closePermissionModal,
        afterPermissionAttempt,
        permissionState,
        isPermissionDenied: permissionState === 'denied',
        isPermissionGranted: permissionState === 'granted',
        isRequestingPermission,
        refreshPermissionState,
    }
}
