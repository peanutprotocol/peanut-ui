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
 * starts on, and Continue asks the OS for permission in the same tap.
 */
export default function NotificationsStep() {
    const t = useTranslations('setup.notifications')
    const { notificationChoices, setNotificationChoices, setIsLoading: setSetupLoading } = useSetupFlowContext()
    const { handleNext } = useSetupFlow()
    const { requestPermission, afterPermissionAttempt } = useNotifications()
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string>()
    // Only a user who turned push off opted out. An OS refusal leaves the
    // account's server default alone.
    const [optedOut, setOptedOut] = useState(false)
    const savingRef = useRef(false)
    const push = notificationChoices.push

    const onToggle = (on: boolean) => {
        setError(undefined)
        setOptedOut(!on)
        setNotificationChoices({ ...notificationChoices, push: on })
    }

    const askPermission = async () => {
        try {
            const permission = await requestPermission()
            await afterPermissionAttempt()
            return permission === 'granted'
        } catch {
            return false
        }
    }

    const save = async () => {
        if (savingRef.current) return
        savingRef.current = true
        // Started before any other await, so the browser accepts the prompt from this tap.
        const granted = push ? askPermission() : Promise.resolve(false)
        setSaving(true)
        setSetupLoading(true)
        setError(undefined)
        try {
            if (push) {
                if (await granted) {
                    // Subscribed is the server default, so a failure never blocks signup. The write
                    // is still awaited: left in flight, it could land after an opt-out made by coming
                    // back to this step, and the API keeps the last write.
                    await notificationsApi.savePreferences({ push: true, email: true }).catch(() => {})
                } else {
                    setNotificationChoices({ ...notificationChoices, push: false })
                }
            } else if (optedOut) {
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
                        <Toggle aria-label={t('pushLabel')} checked={push} onChange={onToggle} disabled={saving} />
                    }
                />
                {error && <Callout priority="error">{error}</Callout>}
            </div>
            <SetupFooter
                actions={
                    <Button onClick={save} shadowSize="4" loading={saving} disabled={saving}>
                        {t('continue')}
                    </Button>
                }
            />
        </div>
    )
}
