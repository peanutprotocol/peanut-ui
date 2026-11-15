'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import NotificationsStepLayout from '../components/NotificationsStepLayout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { Callout } from '@/components/0_Bruddle/Callout'
import { useNotifications } from '@/hooks/useNotifications'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { trackPromptAnswer } from '@/features/setup/notificationsExperiment'
import { notificationsApi, toPushPermission } from '@/services/notifications'
import { useSessionFence, type SessionFence } from '@/hooks/useSessionFence'
import { useSignupControl } from '@/features/setup/useSignupControl'

/**
 * The notifications experiment's control: the step as it was before the three
 * switches. One push switch starts off, and turning it on asks the OS in the
 * same tap. Delete it with the experiment.
 */
export default function NotificationsControl() {
    const t = useTranslations('setup.notifications')
    const tControl = useTranslations('setup.notificationsControl')
    const { notificationChoices, setNotificationChoices, setIsLoading: setSetupLoading } = useSetupFlowContext()
    const { handleNext } = useSetupFlow()
    const { requestPermission, afterPermissionAttempt } = useNotifications()
    const [saving, setSaving] = useState(false)
    const [requesting, setRequesting] = useState(false)
    const [error, setError] = useState<string>()
    // Only a user who turned push on and then off again opted out. The default
    // off state and an OS refusal leave the account's server default alone.
    const [optedOut, setOptedOut] = useState(false)
    const savingRef = useRef(false)
    const requestingRef = useRef(false)
    const captureSession = useSessionFence()
    const choiceOwner = useRef<SessionFence | null>(null)
    const push = notificationChoices.push
    const { track, trackError } = useSignupControl()

    const onToggle = async (on: boolean) => {
        if (requestingRef.current || savingRef.current) return
        requestingRef.current = true
        const session = captureSession()
        setRequesting(true)
        try {
            if (session.ready) await session.ready
            if (!session.current()) return
            track('push', 'toggle', on ? 'on' : 'off')
            trackError('notification_preferences', null)
            choiceOwner.current = session
            setError(undefined)
            setNotificationChoices({ ...notificationChoices, push: on })
            if (!on) {
                setOptedOut(true)
                return
            }
            setOptedOut(false)
            trackError('push_permission', null)
            // Started inside the tap, so the browser accepts the permission request.
            const permission = toPushPermission(await requestPermission())
            if (!session.current()) return
            await afterPermissionAttempt()
            if (!session.current()) return
            trackPromptAnswer('control', permission)
            trackError('push_permission', permission === 'granted' ? null : permission)
            if (permission !== 'granted') setNotificationChoices({ ...notificationChoices, push: false })
        } catch {
            if (!session.current()) return
            trackPromptAnswer('control', 'dismissed')
            trackError('push_permission', 'dismissed')
            setNotificationChoices({ ...notificationChoices, push: false })
        } finally {
            requestingRef.current = false
            if (session.current()) setRequesting(false)
        }
    }

    const save = async () => {
        if (savingRef.current) return
        const session = captureSession()
        if (!session.current() || (choiceOwner.current && !choiceOwner.current.current())) return
        track('continue', 'tap')
        trackError('notification_preferences', null)
        savingRef.current = true
        setSaving(true)
        setSetupLoading(true)
        setError(undefined)
        try {
            if (session.ready) await session.ready
            if (!session.current()) return
            if (optedOut && !push) {
                // An explicit opt-out must be acknowledged before leaving: unset
                // preferences default to subscribed on the server.
                const saved = await notificationsApi.savePreferences({ push: false }, session.userId ?? undefined).then(
                    () => true,
                    () => false
                )
                if (!session.current()) return
                if (!saved) {
                    setError(t('saveFailed'))
                    trackError('notification_preferences', 'save_failed')
                    return
                }
            } else if (push) {
                // Subscribed is the server default, so a failure never blocks signup. The write is
                // still awaited: left in flight, it could land after an opt-out made by coming back
                // to this step, and the API keeps the last write.
                await notificationsApi
                    .savePreferences({ push: true, pushPermission: 'granted' }, session.userId ?? undefined)
                    .catch(() => {
                        if (session.current()) trackError('notification_preferences', 'save_failed')
                    })
            }
            if (!session.current()) return
            await handleNext()
        } finally {
            savingRef.current = false
            if (session.current()) {
                setSaving(false)
                setSetupLoading(false)
            }
        }
    }

    return (
        <NotificationsStepLayout title={tControl('title')} description={tControl('description')}>
            <div className="flex flex-1 flex-col justify-center gap-3">
                <ListItem
                    className="py-3"
                    title={tControl('pushLabel')}
                    // A toggle row sets a preference, so its bubble is blue (design.md icon bubble ruling).
                    leading={<IconBubble icon="bell" size="s" color="blue" />}
                    trailing={
                        <Toggle
                            aria-label={tControl('pushLabel')}
                            checked={push}
                            onChange={(value) => void onToggle(value)}
                            disabled={saving || requesting}
                        />
                    }
                />
                {error && <Callout priority="error">{error}</Callout>}
            </div>
            <SetupFooter
                actions={
                    <Button onClick={save} shadowSize="4" loading={saving} disabled={saving || requesting}>
                        {t('continue')}
                    </Button>
                }
            />
        </NotificationsStepLayout>
    )
}
