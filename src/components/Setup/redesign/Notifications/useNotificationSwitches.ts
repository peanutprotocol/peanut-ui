'use client'

import { useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import {
    isUntouchedNotificationChoices,
    type NotificationChoices,
    useSetupFlowContext,
} from '@/features/setup/SetupFlowContext'
import { type SwitchesVariant, trackPromptAnswer } from '@/features/setup/notificationsExperiment'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useNotifications } from '@/hooks/useNotifications'
import { type SessionFence, useSessionFence } from '@/hooks/useSessionFence'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import {
    notificationsApi,
    type PreferenceChanges,
    type PushPermission,
    toPushPermission,
} from '@/services/notifications'

export type NotificationSwitch = 'push' | 'marketingPush' | 'emailUpdates'

const ALL_OFF = { push: false, marketingPush: false, emailUpdates: false }
// Already cascaded, so switching Important back on never brings back an Email updates the user turned off.
const DEFAULTS_ON: NotificationChoices = {
    push: true,
    // Never on by default: App Store Review Guideline 4.5.4 requires the user's explicit opt-in to marketing pushes.
    marketingPush: false,
    emailUpdates: true,
    cascaded: true,
}

/**
 * The experiment's switch arms, moved unchanged from dev's `NotificationSwitches` (`Views/Notifications.tsx`).
 * In `switches` the three switches start off, and the first time Important alerts turns on, Email updates turns
 * on with it; Offers and perks never follows another switch. In `defaults_on` Important alerts and Email updates
 * start on until the user changes one. Continue asks the OS when a push switch is on and saves what its answer
 * allows; Not now saves all three off.
 */
export function useNotificationSwitches(variant: SwitchesVariant) {
    const {
        notificationChoices: storedChoices,
        setNotificationChoices,
        setIsLoading: setSetupLoading,
    } = useSetupFlowContext()
    const notificationChoices =
        variant === 'defaults_on' && isUntouchedNotificationChoices(storedChoices) ? DEFAULTS_ON : storedChoices
    const { handleNext } = useSetupFlow()
    const { requestPermission, afterPermissionAttempt } = useNotifications()
    const [saving, setSaving] = useState(false)
    const [failed, setFailed] = useState(false)
    const savingRef = useRef(false)
    // A retry after a failed save reuses the answer instead of asking again.
    const permissionRef = useRef<PushPermission>()
    const captureSession = useSessionFence()
    const { push, marketingPush, emailUpdates } = notificationChoices
    const { track, trackError } = useSignupControl()
    const anyOn = push || marketingPush || emailUpdates

    const toggle = (key: NotificationSwitch, on: boolean) => {
        const control = { push: 'push', marketingPush: 'marketing_push', emailUpdates: 'email_updates' }[key]
        track(control, 'toggle', on ? 'on' : 'off')
        trackError('notification_preferences', null)
        setFailed(false)
        const cascade = key === 'push' && on && !notificationChoices.cascaded
        setNotificationChoices({
            ...notificationChoices,
            [key]: on,
            ...(cascade && { emailUpdates: true, cascaded: true }),
        })
    }

    const askPermission = async (session: SessionFence): Promise<PushPermission> => {
        if (permissionRef.current) return permissionRef.current
        trackError('push_permission', null)
        try {
            const permission = toPushPermission(await requestPermission())
            if (!session.current()) return 'dismissed'
            await afterPermissionAttempt()
            if (!session.current()) return 'dismissed'
            permissionRef.current = permission
            trackPromptAnswer(variant, permission)
            trackError('push_permission', permission === 'granted' ? null : permission)
            return permission
        } catch {
            if (session.current()) {
                trackPromptAnswer(variant, 'dismissed')
                trackError('push_permission', 'dismissed')
            }
            return 'dismissed'
        }
    }

    const save = async (skip: boolean) => {
        if (savingRef.current) return
        const session = captureSession()
        if (!session.current()) return
        track(skip ? 'not_now' : 'continue', 'tap')
        trackError('notification_preferences', null)
        savingRef.current = true
        setSaving(true)
        setSetupLoading(true)
        setFailed(false)
        try {
            if (session.ready) await session.ready
            if (!session.current()) return
            // Readable sessions start the prompt in the tap's user gesture.
            const permission = !skip && (push || marketingPush) ? askPermission(session) : undefined
            const answer = (await permission) ?? permissionRef.current
            if (!session.current()) return
            const pushAllowed = answer === 'granted'
            const saved: NotificationChoices = {
                ...notificationChoices,
                ...(skip ? ALL_OFF : { push: push && pushAllowed, marketingPush: marketingPush && pushAllowed }),
            }
            const changes: PreferenceChanges = {
                push: saved.push,
                marketingPush: saved.marketingPush,
                emailUpdates: saved.emailUpdates,
                ...(answer && { pushPermission: answer }),
            }
            const ok = await notificationsApi.savePreferences(changes, session.userId ?? undefined).then(
                () => true,
                () => false
            )
            if (!session.current()) return
            // A skip needs acknowledgement too: the API stores only opt-outs, so unsaved Email updates stays on.
            if (!ok) {
                setFailed(true)
                trackError('notification_preferences', 'save_failed')
                return
            }
            setNotificationChoices(saved)
            posthog.capture(ANALYTICS_EVENTS.NOTIFICATION_CHOICES_SAVED, {
                variant,
                outcome: skip ? 'skipped' : (answer ?? 'not_asked'),
                important: saved.push,
                offers: saved.marketingPush,
                email: saved.emailUpdates,
            })
            await handleNext()
        } finally {
            savingRef.current = false
            if (session.current()) {
                setSaving(false)
                setSetupLoading(false)
            }
        }
    }

    return { notificationChoices, anyOn, saving, failed, toggle, save }
}
