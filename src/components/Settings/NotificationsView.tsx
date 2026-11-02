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
import { useSessionFence, type SessionFence } from '@/hooks/useSessionFence'

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
    const captureSession = useSessionFence()

    const load = useCallback(() => {
        setLoadFailed(false)
        notificationsApi.getPreferences().then(setChoices, () => setLoadFailed(true))
    }, [])
    useEffect(load, [load])

    const askPermission = async (session: SessionFence): Promise<PushPermission> => {
        try {
            const permission = toPushPermission(await requestPermission())
            if (!session.current()) return 'dismissed'
            await afterPermissionAttempt()
            return permission
        } catch {
            return 'dismissed'
        }
    }

    const save = async (key: Switch, on: boolean, session: SessionFence, permission?: Promise<PushPermission>) => {
        if (!choices || savingRef.current) return
        savingRef.current = true
        setChoices({ ...choices, [key]: on })
        setSaving(true)
        try {
            const answer = await permission
            if (!session.current()) return
            // A push switch can't work without the OS permission, so a refusal saves it off.
            const changes: PreferenceChanges = {
                [key]: on && (answer === undefined || answer === 'granted'),
                ...(answer && { pushPermission: answer }),
            }
            const saved = await notificationsApi.savePreferences(changes, session.userId!)
            if (session.current()) setChoices(saved)
        } catch {
            if (!session.current()) return
            try {
                const fresh = await notificationsApi.getPreferences()
                if (!session.current()) return
                setChoices(fresh)
            } catch {
                if (!session.current()) return
                setChoices(null)
                setLoadFailed(true)
            }
            toast.error(tCommon('genericError'))
        } finally {
            savingRef.current = false
            if (session.current()) setSaving(false)
        }
    }

    const onToggle = (key: Switch, on: boolean) => {
        const session = captureSession()
        if (!session.current()) return
        // Asked inside the tap, so the browser accepts the prompt as a user gesture.
        const permission = on && key !== 'emailUpdates' ? askPermission(session) : undefined
        void save(key, on, session, permission)
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
