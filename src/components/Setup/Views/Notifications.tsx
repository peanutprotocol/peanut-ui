'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import SetupFooter from '../components/SetupFooter'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { Callout } from '@/components/0_Bruddle/Callout'
import { type IconName } from '@/components/Global/Icons/Icon'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useNotifications } from '@/hooks/useNotifications'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { type NotificationChoices, useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import {
    notificationsApi,
    toPushPermission,
    type PreferenceChanges,
    type PushPermission,
} from '@/services/notifications'

type Switch = 'push' | 'marketingPush' | 'emailUpdates'

const SWITCHES: { key: Switch; icon: IconName; label: 'important' | 'offers' | 'email' }[] = [
    { key: 'push', icon: 'bell', label: 'important' },
    { key: 'marketingPush', icon: 'gift', label: 'offers' },
    { key: 'emailUpdates', icon: 'mail', label: 'email' },
]

const ALL_OFF = { push: false, marketingPush: false, emailUpdates: false }

/**
 * Three switches, all off at the start. The first time Important alerts turns on,
 * Email updates turns on with it. Offers and perks never follows another switch:
 * marketing pushes need the user's own tap (App Store 4.5.4, GDPR, LGPD).
 * Continue asks the OS when a push switch is on and saves what its answer allows.
 */
export default function NotificationsStep() {
    const t = useTranslations('setup.notifications')
    const { notificationChoices, setNotificationChoices, setIsLoading: setSetupLoading } = useSetupFlowContext()
    const { handleNext } = useSetupFlow()
    const { requestPermission, afterPermissionAttempt } = useNotifications()
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string>()
    const savingRef = useRef(false)
    // A retry after a failed save reuses the answer instead of asking again.
    const permissionRef = useRef<PushPermission>()
    const { push, marketingPush, emailUpdates } = notificationChoices
    const anyOn = push || marketingPush || emailUpdates

    const onToggle = (key: Switch, on: boolean) => {
        setError(undefined)
        const cascade = key === 'push' && on && !notificationChoices.cascaded
        setNotificationChoices({
            ...notificationChoices,
            [key]: on,
            ...(cascade && { emailUpdates: true, cascaded: true }),
        })
    }

    const askPermission = async (): Promise<PushPermission> => {
        if (permissionRef.current) return permissionRef.current
        try {
            const permission = toPushPermission(await requestPermission())
            await afterPermissionAttempt()
            permissionRef.current = permission
            return permission
        } catch {
            return 'dismissed'
        }
    }

    const save = async (skip: boolean) => {
        if (savingRef.current) return
        savingRef.current = true
        const asksPermission = !skip && (push || marketingPush)
        // Started before any other await, so the browser accepts the prompt from this tap.
        const permission = asksPermission ? askPermission() : undefined
        setSaving(true)
        setSetupLoading(true)
        setError(undefined)
        try {
            const answer = (await permission) ?? permissionRef.current
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
            // Unset preferences default to subscribed on the server, so every answer,
            // the opt-outs included, must be acknowledged before leaving.
            const ok = await notificationsApi.savePreferences(changes).then(
                () => true,
                () => false
            )
            // Keeping the switches as tapped until the save lands leaves Continue there to retry.
            if (!ok) {
                setError(t('saveFailed'))
                return
            }
            setNotificationChoices(saved)
            posthog.capture(ANALYTICS_EVENTS.NOTIFICATION_CHOICES_SAVED, {
                outcome: skip ? 'skipped' : (answer ?? 'not_asked'),
                important: saved.push,
                offers: saved.marketingPush,
                email: saved.emailUpdates,
            })
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
                {/* A toggle row sets a preference, so its bubble is blue (design.md icon bubble ruling). */}
                <ListGroup>
                    {SWITCHES.map(({ key, icon, label }) => (
                        <ListItem
                            key={key}
                            className="py-3"
                            title={t(`${label}Label`)}
                            body={t(`${label}Description`)}
                            bodyWrap
                            leading={<IconBubble icon={icon} size="s" color="blue" />}
                            trailing={
                                <Toggle
                                    aria-label={t(`${label}Label`)}
                                    checked={notificationChoices[key]}
                                    onChange={(on) => onToggle(key, on)}
                                    disabled={saving}
                                />
                            }
                        />
                    ))}
                </ListGroup>
                <p className="text-body-xs text-foreground-secondary">{t('changeAnytime')}</p>
                {error && <Callout priority="error">{error}</Callout>}
            </div>
            <SetupFooter
                actions={
                    <Button
                        onClick={() => void save(false)}
                        shadowSize="4"
                        loading={saving}
                        disabled={saving || !anyOn}
                    >
                        {t('continue')}
                    </Button>
                }
                secondary={
                    <LinkButton onClick={() => void save(true)} disabled={saving}>
                        {t('notNow')}
                    </LinkButton>
                }
            />
        </div>
    )
}
