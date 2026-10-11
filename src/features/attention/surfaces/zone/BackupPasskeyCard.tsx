'use client'

import { useRouter } from 'next/navigation'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { ZoneSurfaceProps } from '../../types'

/** One passkey backs the account: the backup page adds a second one. */
export default function BackupPasskeyCard({ onDismissed }: ZoneSurfaceProps) {
    const t = useAppTranslations('home.carousel')
    const router = useRouter()
    return (
        <CarouselCTA
            title={t('backupPasskey.title')}
            description={t('backupPasskey.description')}
            icon="lock"
            onClose={onDismissed}
            onClick={() => router.push('/profile/backup')}
        />
    )
}
