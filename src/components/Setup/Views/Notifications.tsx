'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { Callout } from '@/components/0_Bruddle/Callout'
import { useNotifications } from '@/hooks/useNotifications'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { notificationsApi } from '@/services/notifications'

export default function NotificationsStep() {
    const t = useTranslations('setup.notifications')
    const { notificationChoices, setNotificationChoices } = useSetupFlowContext()
    const { handleNext } = useSetupFlow()
    const { requestPermission, afterPermissionAttempt, oneSignalInitialized } = useNotifications()
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string>()
    const savingRef = useRef(false)
    const save = async () => {
        if (savingRef.current) return
        savingRef.current = true
        setSaving(true)
        setError(undefined)
        try {
            await notificationsApi.savePreferences(notificationChoices)
            if (notificationChoices.push) {
                if (!oneSignalInitialized) {
                    setError(t('pushUnavailable'))
                    return
                }
                // Ask only after the explanation, on the user's Continue action.
                // Denial or dismissal is a valid answer and never blocks signup.
                await requestPermission()
                await afterPermissionAttempt()
            }
            await handleNext()
        } catch {
            setError(t('saveFailed'))
        } finally {
            savingRef.current = false
            setSaving(false)
        }
    }
    return (
        <div className="flex w-full flex-col gap-6">
            <div className="flex flex-col gap-4">
                {(['push', 'email'] as const).map((channel) => (
                    <div key={channel} className="flex items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-label-l">{t(`${channel}Label`)}</span>
                            <p className="text-body-xs text-foreground-secondary">{t(`${channel}Description`)}</p>
                        </div>
                        <Toggle
                            aria-label={t(`${channel}Label`)}
                            checked={notificationChoices[channel]}
                            onChange={(value) => {
                                setNotificationChoices({ ...notificationChoices, [channel]: value })
                                setError(undefined)
                            }}
                            disabled={saving}
                        />
                    </div>
                ))}
            </div>
            {error && <Callout priority="error">{error}</Callout>}
            <Button onClick={save} shadowSize="4" loading={saving} disabled={saving}>
                {t('continue')}
            </Button>
            <p className="text-body-xs text-foreground-secondary">{t('permissionHint')}</p>
        </div>
    )
}
