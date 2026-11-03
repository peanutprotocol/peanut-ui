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
import {
    isUntouchedNotificationChoices,
    type NotificationChoices,
    useSetupFlowContext,
} from '@/features/setup/SetupFlowContext'
import {
    type NotificationsVariant,
    readNotificationsVariant,
    trackPromptAnswer,
} from '@/features/setup/notificationsExperiment'
import NotificationsStepLayout from '../components/NotificationsStepLayout'
import { useSessionFence, type SessionFence } from '@/hooks/useSessionFence'
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
// Already cascaded, so switching Important back on never brings back an Email updates the user turned off.
const ALL_ON: NotificationChoices = { push: true, marketingPush: true, emailUpdates: true, cascaded: true }

/**
 * Three switches. In control they start off, and the first time Important alerts
 * turns on, Email updates turns on with it; Offers and perks never follows another
 * switch. In `all_on` all three start on until the user changes one.
 * Continue asks the OS when a push switch is on and saves what its answer allows.
 */
function NotificationSwitches({ variant }: { variant: NotificationsVariant }) {
    const t = useTranslations('setup.notifications')
    const tSetup = useTranslations('setup')
    const {
        notificationChoices: storedChoices,
        setNotificationChoices,
        setIsLoading: setSetupLoading,
    } = useSetupFlowContext()
    const notificationChoices =
        variant === 'all_on' && isUntouchedNotificationChoices(storedChoices) ? ALL_ON : storedChoices
    const { handleNext } = useSetupFlow()
    const { requestPermission, afterPermissionAttempt, permissionState } = useNotifications()
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string>()
    const savingRef = useRef(false)
    // A retry after a failed save reuses the answer instead of asking again.
    const permissionRef = useRef<PushPermission>()
    const captureSession = useSessionFence()
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

    const askPermission = async (session: SessionFence): Promise<PushPermission> => {
        if (permissionRef.current) return permissionRef.current
        try {
            const permission = toPushPermission(await requestPermission())
            if (!session.current()) return 'dismissed'
            await afterPermissionAttempt()
            if (!session.current()) return 'dismissed'
            permissionRef.current = permission
            trackPromptAnswer(variant, permission)
            return permission
        } catch {
            if (session.current()) trackPromptAnswer(variant, 'dismissed')
            return 'dismissed'
        }
    }

    const save = async (skip: boolean) => {
        if (savingRef.current) return
        const session = captureSession()
        if (!session.current()) return
        savingRef.current = true
        setSaving(true)
        setSetupLoading(true)
        setError(undefined)
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
            // Continue always needs acknowledgement. A skip only does when push could arrive.
            const pushCouldArrive = permissionState === 'granted' || permissionRef.current === 'granted'
            if (!ok && (!skip || pushCouldArrive)) {
                setError(t('saveFailed'))
                return
            }
            setNotificationChoices(saved)
            if (ok)
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

    return (
        // Balanced, so the two-line title breaks after "notifications" instead of leaving the last words alone.
        <NotificationsStepLayout title={tSetup('steps.notification-permission.title')} titleClassName="text-balance">
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
        </NotificationsStepLayout>
    )
}

export default function NotificationsStep() {
    const [variant] = useState(readNotificationsVariant)
    return <NotificationSwitches variant={variant} />
}
