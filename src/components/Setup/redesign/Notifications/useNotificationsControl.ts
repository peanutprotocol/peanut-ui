'use client'

import { useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useNotifications } from '@/hooks/useNotifications'
import { type SessionFence, useSessionFence } from '@/hooks/useSessionFence'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { notificationsApi, type PushPermission, toPushPermission } from '@/services/notifications'
import { openAppSettings } from '@/utils/native-settings'

export type NotificationsControlState = 'default' | 'prompt' | 'denied'

const trackPromptAnswer = (answer: PushPermission) =>
    posthog.capture(ANALYTICS_EVENTS.SIGNUP_PUSH_PERMISSION_ANSWERED, { answer })

/**
 * The sign-up notifications step in the drawn one-button form, with dev's outcomes
 * (`Views/NotificationsControl.tsx`): "Turn on" is dev's toggle-on and its granted save in one tap, "Not now" is
 * dev's explicit opt-out (on, then off, then Continue: saves `push: false` and blocks on a failed save), and an OS
 * refusal stays on the step (`denied`). Push only: the step never writes `marketingPush` or `emailUpdates` (App
 * Store Review Guideline 4.5.4).
 */
export function useNotificationsControl() {
    const { notificationChoices, setNotificationChoices, setIsLoading: setSetupLoading } = useSetupFlowContext()
    const { handleNext } = useSetupFlow()
    const { requestPermission, afterPermissionAttempt } = useNotifications()
    const [requesting, setRequesting] = useState(false)
    const [saving, setSaving] = useState(false)
    const [denied, setDenied] = useState(false)
    const [saveFailed, setSaveFailed] = useState(false)
    const requestingRef = useRef(false)
    const savingRef = useRef(false)
    const captureSession = useSessionFence()
    const { track, trackError } = useSignupControl()

    const leave = async (session: SessionFence) => {
        if (session.ready) await session.ready
        if (!session.current()) return
        await handleNext()
    }

    const turnOn = async () => {
        if (requestingRef.current || savingRef.current) return
        requestingRef.current = true
        const session = captureSession()
        setRequesting(true)
        try {
            if (session.ready) await session.ready
            if (!session.current()) return
            track('push', 'toggle', 'on')
            trackError('notification_preferences', null)
            setSaveFailed(false)
            setNotificationChoices({ ...notificationChoices, push: true })
            trackError('push_permission', null)
            let permission: PushPermission
            try {
                // Started inside the tap, so the browser accepts the permission request.
                permission = toPushPermission(await requestPermission())
                if (!session.current()) return
                await afterPermissionAttempt()
                if (!session.current()) return
            } catch {
                if (!session.current()) return
                trackPromptAnswer('dismissed')
                trackError('push_permission', 'dismissed')
                setNotificationChoices({ ...notificationChoices, push: false })
                return
            }
            trackPromptAnswer(permission)
            trackError('push_permission', permission === 'granted' ? null : permission)
            if (permission !== 'granted') {
                setNotificationChoices({ ...notificationChoices, push: false })
                // the OS will not ask again: stay, say where to turn them on, offer Continue
                if (permission === 'denied') setDenied(true)
                return
            }
            savingRef.current = true
            setSaving(true)
            setSetupLoading(true)
            // Subscribed is the server default, so a failure never blocks sign-up. The write is still awaited: left
            // in flight, it could land after a later change on this step, and the API keeps the last write.
            await notificationsApi
                .savePreferences({ push: true, pushPermission: 'granted' }, session.userId ?? undefined)
                .catch(() => {
                    if (session.current()) trackError('notification_preferences', 'save_failed')
                })
            if (!session.current()) return
            await handleNext()
        } finally {
            requestingRef.current = false
            savingRef.current = false
            if (session.current()) {
                setRequesting(false)
                setSaving(false)
                setSetupLoading(false)
            }
        }
    }

    /**
     * "Not now" is an explicit opt-out and must be acknowledged before leaving: unset preferences default to
     * subscribed on the server, so a later OS grant from settings would send account pushes the user declined.
     * The denied Continue leaves the server default alone, as dev's OS refusal did.
     */
    const goOn = async (control: 'not_now' | 'continue') => {
        if (requestingRef.current || savingRef.current) return
        const session = captureSession()
        if (!session.current()) return
        track(control, 'tap')
        savingRef.current = true
        setSaving(true)
        setSetupLoading(true)
        try {
            if (control === 'not_now') {
                trackError('notification_preferences', null)
                setSaveFailed(false)
                setNotificationChoices({ ...notificationChoices, push: false })
                if (session.ready) await session.ready
                if (!session.current()) return
                const saved = await notificationsApi.savePreferences({ push: false }, session.userId ?? undefined).then(
                    () => true,
                    () => false
                )
                if (!session.current()) return
                if (!saved) {
                    setSaveFailed(true)
                    trackError('notification_preferences', 'save_failed')
                    return
                }
            }
            await leave(session)
        } finally {
            savingRef.current = false
            if (session.current()) {
                setSaving(false)
                setSetupLoading(false)
            }
        }
    }

    const openSettings = () => {
        track('open_settings', 'tap')
        void openAppSettings()
    }

    const state: NotificationsControlState = denied ? 'denied' : requesting && !saving ? 'prompt' : 'default'
    return { state, requesting, saving, saveFailed, turnOn, goOn, openSettings }
}
