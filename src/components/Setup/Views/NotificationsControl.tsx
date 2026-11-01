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
    const push = notificationChoices.push

    const onToggle = async (on: boolean) => {
        setError(undefined)
        setNotificationChoices({ ...notificationChoices, push: on })
        if (!on) {
            setOptedOut(true)
            return
        }
        setOptedOut(false)
        setRequesting(true)
        try {
            // Started inside the tap, so the browser accepts the permission request.
            const permission = toPushPermission(await requestPermission())
            await afterPermissionAttempt()
            trackPromptAnswer('control', permission)
            if (permission !== 'granted') setNotificationChoices({ ...notificationChoices, push: false })
        } catch {
            trackPromptAnswer('control', 'dismissed')
            setNotificationChoices({ ...notificationChoices, push: false })
        } finally {
            setRequesting(false)
        }
    }

    const save = async () => {
        if (savingRef.current) return
        savingRef.current = true
        setSaving(true)
        setSetupLoading(true)
        setError(undefined)
        try {
            if (optedOut && !push) {
                // An explicit opt-out must be acknowledged before leaving: unset
                // preferences default to subscribed on the server.
                const saved = await notificationsApi.savePreferences({ push: false }).then(
                    () => true,
                    () => false
                )
                if (!saved) {
                    setError(t('saveFailed'))
                    return
                }
            } else if (push) {
                // Subscribed is the server default, so a failure never blocks signup. The write is
                // still awaited: left in flight, it could land after an opt-out made by coming back
                // to this step, and the API keeps the last write.
                await notificationsApi.savePreferences({ push: true, pushPermission: 'granted' }).catch(() => {})
            }
            await handleNext()
        } finally {
            savingRef.current = false
            setSaving(false)
            setSetupLoading(false)
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
