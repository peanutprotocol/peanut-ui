'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useToast } from '@/components/0_Bruddle/Toast'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import NavHeader from '@/components/Global/NavHeader'
import { type IconName } from '@/components/Global/Icons/Icon'
import { useNotifications } from '@/hooks/useNotifications'
import { useSafeBack } from '@/hooks/useSafeBack'
import {
    notificationsApi,
    toPushPermission,
    type NotificationPreferences,
    type PreferenceChanges,
    type PushPermission,
} from '@/services/notifications'
import { canOpenAppSettings, openAppSettings } from '@/utils/native-settings'

type Switch = 'push' | 'marketingPush' | 'emailUpdates'

const SWITCHES: { key: Switch; icon: IconName; label: 'important' | 'offers' | 'email' }[] = [
    { key: 'push', icon: 'bell', label: 'important' },
    { key: 'marketingPush', icon: 'gift', label: 'offers' },
    { key: 'emailUpdates', icon: 'mail', label: 'email' },
]

export const NotificationsView = () => {
    const t = useTranslations('settings.notifications')
    const tCommon = useTranslations('common')
    const onBack = useSafeBack('/profile')
    const toast = useToast()
    const { requestPermission, afterPermissionAttempt, isPermissionDenied } = useNotifications()
    const [choices, setChoices] = useState<NotificationPreferences | null>(null)
    const [loadFailed, setLoadFailed] = useState(false)
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)

    const load = useCallback(() => {
        setLoadFailed(false)
        notificationsApi.getPreferences().then(setChoices, () => setLoadFailed(true))
    }, [])
    useEffect(load, [load])

    const askPermission = async (): Promise<PushPermission> => {
        try {
            const permission = toPushPermission(await requestPermission())
            await afterPermissionAttempt()
            return permission
        } catch {
            return 'dismissed'
        }
    }

    const save = async (key: Switch, on: boolean, permission?: Promise<PushPermission>) => {
        if (!choices || savingRef.current) return
        savingRef.current = true
        const before = choices
        setChoices({ ...choices, [key]: on })
        setSaving(true)
        try {
            const answer = await permission
            // A push switch can't work without the OS permission, so a refusal saves it off.
            const changes: PreferenceChanges = {
                [key]: on && (answer === undefined || answer === 'granted'),
                ...(answer && { pushPermission: answer }),
            }
            setChoices(await notificationsApi.savePreferences(changes))
        } catch {
            setChoices(before)
            toast.error(tCommon('genericError'))
        } finally {
            savingRef.current = false
            setSaving(false)
        }
    }

    const onToggle = (key: Switch, on: boolean) => {
        // Asked inside the tap, so the browser accepts the prompt as a user gesture.
        const permission = on && key !== 'emailUpdates' ? askPermission() : undefined
        void save(key, on, permission)
    }

    return (
        <PageStack gap="6" className="h-full bg-background-page">
            <NavHeader title={t('title')} onPrev={onBack} />
            {loadFailed ? (
                <Callout priority="error" ctas={[{ label: tCommon('retry'), onClick: load }]}>
                    {t('loadFailed')}
                </Callout>
            ) : (
                <>
                    {/* A toggle row sets a preference, so its bubble is blue (design.md icon bubble ruling). */}
                    <ListGroup>
                        {SWITCHES.map(({ key, icon, label }) => (
                            <ListItem
                                key={key}
                                title={t(label)}
                                body={t(`${label}Body`)}
                                bodyWrap
                                leading={<IconBubble icon={icon} size="s" color="blue" />}
                                trailing={
                                    <Toggle
                                        aria-label={t(label)}
                                        checked={choices?.[key] ?? false}
                                        onChange={(on) => onToggle(key, on)}
                                        disabled={!choices || saving}
                                    />
                                }
                            />
                        ))}
                    </ListGroup>
                    {isPermissionDenied && (
                        <Callout
                            priority="attention"
                            ctas={
                                canOpenAppSettings()
                                    ? [{ label: t('openSettings'), onClick: () => void openAppSettings() }]
                                    : undefined
                            }
                        >
                            {t('blocked')}
                        </Callout>
                    )}
                </>
            )}
        </PageStack>
    )
}
