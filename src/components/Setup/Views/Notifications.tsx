'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { Callout } from '@/components/0_Bruddle/Callout'
import { useNotifications } from '@/hooks/useNotifications'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { notificationsApi } from '@/services/notifications'

/**
 * Push notifications only; the email was collected on the step before. The toggle
 * starts off, and turning it on asks the OS for permission in the same tap.
 */
export default function NotificationsStep() {
    const t = useTranslations('setup.notifications')
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
            const permission = await requestPermission()
            await afterPermissionAttempt()
            if (permission !== 'granted') setNotificationChoices({ ...notificationChoices, push: false })
        } catch {
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
                const saved = await notificationsApi.savePreferences({ push: false, email: true }).then(
                    () => true,
                    () => false
                )
                if (!saved) {
                    setError(t('saveFailed'))
                    return
                }
            } else if (push) {
                // Best effort: subscribed is the server default, so signup never waits on it.
                void notificationsApi.savePreferences({ push: true, email: true }).catch(() => {})
            }
            await handleNext()
        } finally {
            savingRef.current = false
            setSaving(false)
            setSetupLoading(false)
        }
    }

    return (
        <div className="flex w-full flex-1 flex-col gap-6">
            <div className="flex flex-1 flex-col justify-center gap-3">
                <ListItem
                    className="py-3"
                    title={t('pushLabel')}
                    // A toggle row sets a preference, so its bubble is blue (design.md icon bubble ruling).
                    leading={<IconBubble icon="bell" size="s" color="blue" />}
                    trailing={
                        <Toggle
                            aria-label={t('pushLabel')}
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
        </div>
    )
}
