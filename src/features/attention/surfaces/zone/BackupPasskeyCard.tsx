'use client'

import { useRouter } from 'next/navigation'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

/** One passkey backs the account: the backup page guides turning on passkey sync. Sync is invisible to us, so opening the guide is the completion. */
export default function BackupPasskeyCard({ onActed, onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const router = useRouter()
    return (
        <CarouselCTA
            title={t('backupPasskey.title')}
            description={t('backupPasskey.description')}
            icon="lock"
            onClose={onDismissed}
            onClick={() => {
                onActed()
                router.push('/profile/backup')
            }}
        />
    )
}
