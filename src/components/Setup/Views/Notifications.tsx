'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import SetupFooter from '../components/SetupFooter'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
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
    const { requestPermission, afterPermissionAttempt } = useNotifications()
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string>()
    const savingRef = useRef(false)
    const save = async () => {
        if (savingRef.current) return
        savingRef.current = true
        setSaving(true)
        setError(undefined)
        try {
            const preferenceAttempt = notificationsApi.savePreferences(notificationChoices).then(
                () => true,
                () => false
            )
            // Start permission inside the click gesture, before awaiting the
            // preference write. SDK errors and OS denial still allow signup.
            const permissionAttempt = (async () => {
                if (notificationChoices.push) {
                    try {
                        await requestPermission()
                        await afterPermissionAttempt()
                    } catch {}
                }
            })()
            // Unset API preferences default to subscribed. An explicit opt-out
            // must be acknowledged before leaving; default-on saves remain
            // best effort so signup stays available during API failures.
            if ((!notificationChoices.push || !notificationChoices.email) && !(await preferenceAttempt)) {
                setError(t('saveFailed'))
                return
            }
            await permissionAttempt
            await handleNext()
        } finally {
            savingRef.current = false
            setSaving(false)
        }
    }
    return (
        <div className="flex w-full flex-1 flex-col gap-6">
            <div className="flex flex-1 flex-col justify-center gap-3">
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
