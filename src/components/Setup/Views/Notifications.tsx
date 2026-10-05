'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { useNotifications } from '@/hooks/useNotifications'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { notificationsApi } from '@/services/notifications'

export default function NotificationsStep() {
    const t = useTranslations('setup.notifications')
    const { notificationChoices, setNotificationChoices } = useSetupFlowContext()
    const { handleNext } = useSetupFlow()
    const { requestPermission, afterPermissionAttempt } = useNotifications()
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)
    const save = async () => {
        if (savingRef.current) return
        savingRef.current = true
        setSaving(true)
        // Preferences are best-effort: an unavailable backend must not hold
        // the signup flow, even when its request never settles.
        void notificationsApi.savePreferences(notificationChoices).catch(() => {})
        try {
            if (notificationChoices.push) {
                // Ask on Continue. SDK errors and OS denial also allow signup.
                try {
                    await requestPermission()
                    await afterPermissionAttempt()
                } catch {}
            }
            await handleNext()
        } finally {
            savingRef.current = false
            setSaving(false)
        }
    }
    return (
        <div className="flex w-full flex-1 flex-col gap-6">
            <div className="flex flex-1 flex-col justify-center">
                <Card className="divide-y divide-dashed divide-border-default px-4">
                    {(['push', 'email'] as const).map((channel) => (
                        <DataRow
                            spacious
                            key={channel}
                            label={t(`${channel}Label`)}
                            value={
                                <Toggle
                                    aria-label={t(`${channel}Label`)}
                                    checked={notificationChoices[channel]}
                                    onChange={(value) => {
                                        setNotificationChoices({ ...notificationChoices, [channel]: value })
                                    }}
                                    disabled={saving}
                                />
                            }
                        />
                    ))}
                </Card>
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
