'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getFromLocalStorage, saveToLocalStorage } from '@/utils'
import { OneSignalDeferredLoadedCallback } from 'react-onesignal'
import { useUserStore } from '@/redux/hooks'

declare global {
    interface Window {
        OneSignalDeferred?: OneSignalDeferredLoadedCallback[]
    }
}

export function useNotifications() {
    const { user } = useUserStore()
    const externalId = user?.user.userId
    const externalIdRef = useRef<string | null>(null)
    const lastLinkedExternalIdRef = useRef<string | null>(null)
    const [showPermissionModal, setShowPermissionModal] = useState(false)
    const [showReminderBanner, setShowReminderBanner] = useState(false)
    const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [permissionState, setPermissionState] = useState<'default' | 'granted' | 'denied'>(() => {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'default'
        return Notification.permission as 'default' | 'granted' | 'denied'
    })
    const disableExternalIdLoginRef = useRef<boolean>(false)
    const [sdkReady, setSdkReady] = useState(false)

    const getPermissionGranted = useCallback((): Promise<boolean> => {
        return new Promise((resolve) => {
            if (typeof window === 'undefined') return resolve(false)
            // Prefer native Notification.permission for reliable state
            if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
                return resolve(Notification.permission === 'granted')
            }
            window.OneSignalDeferred = window.OneSignalDeferred || []
            window.OneSignalDeferred.push(async function (OneSignal: any) {
                try {
                    const perm = OneSignal?.Notifications?.permission
                    resolve(perm === 'granted' || perm === true)
                } catch {
                    resolve(false)
                }
            })
        })
    }, [])

    const getOptedIn = useCallback((): Promise<boolean> => {
        return new Promise((resolve) => {
            if (typeof window === 'undefined') return resolve(false)
            window.OneSignalDeferred = window.OneSignalDeferred || []
            window.OneSignalDeferred.push(async function (OneSignal: any) {
                try {
                    resolve(Boolean(OneSignal.User?.PushSubscription?.optedIn))
                } catch {
                    resolve(false)
                }
            })
        })
    }, [])

    const requestPermission = useCallback(async (): Promise<void> => {
        if (typeof window === 'undefined') return
        // Try synchronous path first to preserve user gesture
        const os: any = (window as any).OneSignal
        if (os && os.User && os.User.PushSubscription && os.Notifications) {
            try {
                await os.User.PushSubscription.optIn()
            } catch (_) {}
            if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                try {
                    if (os?.Slidedown?.promptPush) {
                        await os.Slidedown.promptPush({ force: true })
                    } else {
                        await os.Notifications.requestPermission()
                    }
                } catch (_) {}
            }
            if (typeof Notification !== 'undefined') {
                setPermissionState(Notification.permission as 'default' | 'granted' | 'denied')
            }
            return
        }
        // Fallback to deferred if SDK not ready yet
        return new Promise((resolve) => {
            window.OneSignalDeferred = window.OneSignalDeferred || []
            window.OneSignalDeferred.push(async function (OneSignal: any) {
                try {
                    try {
                        await OneSignal.User?.PushSubscription?.optIn()
                    } catch (_) {}
                    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
                        try {
                            if (OneSignal?.Slidedown?.promptPush) {
                                await OneSignal.Slidedown.promptPush({ force: true })
                            } else {
                                await OneSignal.Notifications.requestPermission()
                            }
                        } catch (_) {}
                    }
                    if (typeof Notification !== 'undefined') {
                        setPermissionState(Notification.permission as 'default' | 'granted' | 'denied')
                    }
                } finally {
                    resolve()
                }
            })
        })
    }, [])

    const refreshPermissionState = useCallback(() => {
        if (typeof window === 'undefined' || typeof Notification === 'undefined') return
        setPermissionState(Notification.permission as 'default' | 'granted' | 'denied')
    }, [])

    const evaluateVisibility = useCallback(async () => {
        // Wait until OneSignal SDK is ready so permission requests run in the same user gesture
        if (!sdkReady) return
        const granted = await getPermissionGranted()
        const optedIn = await getOptedIn()

        if (granted || optedIn) {
            setShowPermissionModal(false)
            setShowReminderBanner(false)
            return
        }

        const modalClosed = Boolean(getFromLocalStorage('notif_modal_closed'))
        const bannerShowAtVal = getFromLocalStorage('notif_banner_show_at')

        if (!modalClosed) {
            setShowPermissionModal(true)
            setShowReminderBanner(false)
            return
        }

        const now = Date.now()
        const bannerShowAt =
            typeof bannerShowAtVal === 'number' ? bannerShowAtVal : parseInt(bannerShowAtVal || '0', 10)
        if (bannerShowAt > 0) {
            if (now >= bannerShowAt) {
                setShowReminderBanner(true)
            } else {
                setShowReminderBanner(false)
                if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
                const delay = Math.max(0, bannerShowAt - now)
                bannerTimerRef.current = setTimeout(() => {
                    evaluateVisibility()
                }, delay)
            }
        } else {
            setShowReminderBanner(false)
        }
    }, [getPermissionGranted, getOptedIn, sdkReady])

    useEffect(() => {
        let mounted = true
        evaluateVisibility()

        if (typeof window !== 'undefined') {
            window.OneSignalDeferred = window.OneSignalDeferred || []
            window.OneSignalDeferred.push(function (OneSignal: any) {
                // Mark SDK ready when available
                setSdkReady(true)
                OneSignal.Notifications?.addEventListener('permissionChange', () => {
                    if (!mounted) return
                    refreshPermissionState()
                    // Re-evaluate UI visibility whenever permission changes
                    evaluateVisibility()
                })
                OneSignal.User?.PushSubscription?.addEventListener('change', async ({ current }: any) => {
                    if (!mounted) return
                    // Ensure current subscription is linked to the logged-in user, if enabled
                    const id = externalIdRef.current
                    if (id && !disableExternalIdLoginRef.current) {
                        try {
                            await OneSignal.login(id)
                        } catch (err: any) {
                            const msg = (err && (err.message || err.toString())) || ''
                            if (msg.toLowerCase().includes('identity') || msg.toLowerCase().includes('verify')) {
                                disableExternalIdLoginRef.current = true
                                console.warn('OneSignal external_id login disabled due to identity verification error')
                            }
                        }
                    }
                    if (current?.optedIn) {
                        setShowPermissionModal(false)
                        setShowReminderBanner(false)
                    }
                })
            })
        }

        return () => {
            mounted = false
            if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
        }
    }, [evaluateVisibility])

    // Keep ref in sync so listeners see the latest user id
    useEffect(() => {
        externalIdRef.current = externalId ?? null
    }, [externalId])

    // Link the logged-in Peanut user to OneSignal external_id, or logout on sign-out
    useEffect(() => {
        if (typeof window === 'undefined') return
        window.OneSignalDeferred = window.OneSignalDeferred || []
        if (externalId && lastLinkedExternalIdRef.current !== externalId) {
            lastLinkedExternalIdRef.current = externalId
            window.OneSignalDeferred.push(async function (OneSignal: any) {
                try {
                    if (!disableExternalIdLoginRef.current) {
                        await OneSignal.login(externalId)
                    }
                } catch (err: any) {
                    const msg = (err && (err.message || err.toString())) || ''
                    if (msg.toLowerCase().includes('identity') || msg.toLowerCase().includes('verify')) {
                        disableExternalIdLoginRef.current = true
                        console.warn('OneSignal external_id login disabled due to identity verification error')
                    }
                }
            })
        } else if (!externalId && lastLinkedExternalIdRef.current !== null) {
            lastLinkedExternalIdRef.current = null
            window.OneSignalDeferred.push(async function (OneSignal: any) {
                try {
                    await OneSignal.logout()
                } catch (_) {}
            })
        }
    }, [externalId])

    const closePermissionModal = useCallback(() => {
        setShowPermissionModal(false)
        // Schedule the banner: for testing 2 seconds; change to 7 days in production
        const showAt = Date.now() + 2000
        saveToLocalStorage('notif_modal_closed', true)
        saveToLocalStorage('notif_banner_show_at', showAt)
        // schedule exact time without requiring refresh
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
        const delay = Math.max(0, showAt - Date.now())
        bannerTimerRef.current = setTimeout(() => {
            evaluateVisibility()
        }, delay)
    }, [evaluateVisibility])

    // Hide the permission modal immediately without scheduling banner
    const hidePermissionModalImmediate = useCallback(() => {
        setShowPermissionModal(false)
    }, [])

    const afterPermissionAttempt = useCallback(async () => {
        // Give the SDK a short moment to create the subscription, then re-check
        setTimeout(() => {
            evaluateVisibility()
        }, 50)
    }, [evaluateVisibility])

    const closeReminderBanner = useCallback(() => {
        // Snooze the banner and reschedule its next appearance (testing: 10 seconds; prod: 7 days)
        const showAt = Date.now() + 10000
        saveToLocalStorage('notif_banner_show_at', showAt)
        setShowReminderBanner(false)
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
        const delay = Math.max(0, showAt - Date.now())
        bannerTimerRef.current = setTimeout(() => {
            evaluateVisibility()
        }, delay)
    }, [evaluateVisibility])

    return {
        showPermissionModal,
        showReminderBanner,
        requestPermission,
        closePermissionModal,
        hidePermissionModalImmediate,
        closeReminderBanner,
        afterPermissionAttempt,
        permissionState,
        isPermissionDenied: permissionState === 'denied',
        refreshPermissionState,
    }
}
