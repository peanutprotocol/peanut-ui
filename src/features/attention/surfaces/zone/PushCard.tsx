'use client'

import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useNotifications } from '@/hooks/useNotifications'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

/** The native push card; a denied permission opens the OS settings through the adapter. */
export default function PushCard({ onActed, onSnoozed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const toast = useToast()
    const { requestPermission, afterPermissionAttempt } = useNotifications()
    return (
        <CarouselCTA
            title={t('notifications.title')}
            description={t('notifications.description')}
            icon="bell"
            onClose={() => onSnoozed()}
            onClick={async () => {
                try {
                    const result = await requestPermission()
                    await afterPermissionAttempt()
                    if (result === 'granted') onActed()
                    else {
                        toast.attention(t('notifications.nativeBlockedToast'))
                        onSnoozed()
                    }
                } catch {
                    toast.attention(t('notifications.nativeBlockedToast'))
                    onSnoozed()
                }
            }}
        />
    )
}
