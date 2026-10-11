'use client'

import { useTranslations } from 'next-intl'
import CarouselCTA from '@/components/Home/HomeCarouselCTA/CarouselCTA'
import { PEANUTMAN_MOBILE } from '@/assets/mascot'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useModalsContext } from '@/context/ModalsContext'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { openStore, storeForDevice } from '@/utils/migration.utils'
import { APP_INSTALL_CARD_COOLDOWN_DAYS } from '../../ledger'
import type { ZoneSurfaceProps } from '../../types'

const DAY_MS = 24 * 60 * 60 * 1000

/** During the native cutover, mobile opens the store and desktop the scan-to-download modal. */
export default function InstallAppCard({ onSnoozed }: ZoneSurfaceProps) {
    const t = useTranslations('migration')
    const { deviceType } = useDeviceType()
    const { setIsGetAppModalOpen } = useModalsContext()
    return (
        <CarouselCTA
            title={t('banner.title')}
            description={t('banner.description')}
            icon="mobile-install"
            logo={PEANUTMAN_MOBILE}
            iconSize={16}
            // the web app is being retired: a close returns after its cooldown
            onClose={() => onSnoozed(Date.now() + APP_INSTALL_CARD_COOLDOWN_DAYS * DAY_MS)}
            onClick={() => {
                const store = storeForDevice(deviceType)
                if (store) openStore(store, MIGRATION_SURFACES.HOME_BANNER)
                else setIsGetAppModalOpen(true)
            }}
        />
    )
}
