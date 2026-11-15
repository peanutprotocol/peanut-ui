'use client'

import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useNotifications } from '@/hooks/useNotifications'
import { PERMISSION_REQUEST_SOURCES } from '@/constants/push-prompt.consts'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'
import { useAttention } from '../../AttentionProvider'
import { useSessionFence } from '@/hooks/useSessionFence'
import { notificationsApi } from '@/services/notifications'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'

/** The native push card; a denied permission opens the OS settings through the adapter. */
export default function PushCard({ onActed, onSnoozed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const tCommon = useTranslations('common')
    const toast = useToast()
    const { requestPermission, afterPermissionAttempt } = useNotifications()
    const { state, holdPushCard } = useAttention()
    const captureSession = useSessionFence()
    const attempting = useRef(false)
    return (
        <CarouselCTA
            title={t('notifications.title')}
            description={t('notifications.description')}
            icon="bell"
            onClose={() => {
                onSnoozed()
                holdPushCard(false)
            }}
            onClick={async () => {
                if (attempting.current) return
                attempting.current = true
                const session = captureSession()
                holdPushCard(true)
                try {
                    if (session.ready) await session.ready
                    if (!session.current()) return
                    const result = await requestPermission(PERMISSION_REQUEST_SOURCES.HOME_CAROUSEL)
                    if (!session.current()) return
                    if (result === 'granted') {
                        if (!state.userId) throw new Error('Missing account')
                        await notificationsApi.savePreferences({ pushPermission: 'granted', push: true }, state.userId)
                        if (!session.current()) return
                    }
                    await afterPermissionAttempt()
                    if (!session.current()) return
                    if (result === 'granted') onActed()
                    else {
                        toast.attention(t('notifications.nativeBlockedToast'))
                        onSnoozed()
                    }
                    holdPushCard(false)
                } catch {
                    if (session.current()) toast.attention(tCommon('somethingWentWrong'))
                } finally {
                    attempting.current = false
                }
            }}
        />
    )
}
