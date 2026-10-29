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
import { useNotifications } from '@/hooks/useNotifications'
import { useSafeBack } from '@/hooks/useSafeBack'
import { notificationsApi, type NotificationPreferences } from '@/services/notifications'

export const NotificationsView = () => {
    const t = useTranslations('settings.notifications')
    const tCommon = useTranslations('common')
    const onBack = useSafeBack('/profile')
    const toast = useToast()
    const { requestPermission, afterPermissionAttempt } = useNotifications()
    const [choices, setChoices] = useState<NotificationPreferences | null>(null)
    const [loadFailed, setLoadFailed] = useState(false)
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)

    const load = useCallback(() => {
        setLoadFailed(false)
        notificationsApi.getPreferences().then(setChoices, () => setLoadFailed(true))
    }, [])
    useEffect(load, [load])

    const save = async (changes: Partial<NotificationPreferences>) => {
        if (!choices || savingRef.current) return
        savingRef.current = true
        const before = choices
        setChoices({ ...choices, ...changes })
        setSaving(true)
        try {
            setChoices(await notificationsApi.savePreferences(changes))
        } catch {
            setChoices(before)
            toast.error(tCommon('genericError'))
        } finally {
            savingRef.current = false
            setSaving(false)
        }
    }

    const onPushToggle = (on: boolean) => {
        // Asked inside the tap, so the browser accepts the prompt as a user gesture.
        if (on)
            void requestPermission()
                .then(afterPermissionAttempt)
                .catch(() => {})
        void save({ push: on })
    }

    const push = choices?.push ?? false
    return (
        <PageStack gap="6" className="h-full bg-background-page">
            <NavHeader title={t('title')} onPrev={onBack} />
            {loadFailed ? (
                <Callout priority="error" ctas={[{ label: tCommon('retry'), onClick: load }]}>
                    {t('loadFailed')}
                </Callout>
            ) : (
                // A toggle row sets a preference, so its bubble is blue (design.md icon bubble ruling).
                <ListGroup>
                    <ListItem
                        title={t('push')}
                        body={t('pushBody')}
                        bodyWrap
                        leading={<IconBubble icon="bell" size="s" color="blue" />}
                        trailing={
                            <Toggle
                                aria-label={t('push')}
                                checked={push}
                                onChange={onPushToggle}
                                disabled={!choices || saving}
                            />
                        }
                    />
                    <ListItem
                        title={t('marketing')}
                        body={t('marketingBody')}
                        bodyWrap
                        disabled={!push}
                        leading={<IconBubble icon="gift" size="s" color="blue" />}
                        trailing={
                            <Toggle
                                aria-label={t('marketing')}
                                checked={push && (choices?.marketingPush ?? false)}
                                onChange={(on) => void save({ marketingPush: on })}
                                disabled={!push || saving}
                            />
                        }
                    />
                </ListGroup>
            )}
        </PageStack>
    )
}
