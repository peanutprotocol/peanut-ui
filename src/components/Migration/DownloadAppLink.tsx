'use client'
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import type { ButtonVariant } from '@/components/0_Bruddle/Button'
import { useAppModal } from '@/components/Migration/AppModalProvider'
import { type MigrationSurface } from '@/constants/migration.consts'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { onStoreAnchorClick, storeAnchorHref, storeForDevice, storeIcon } from '@/utils/migration.utils'

/**
 * The "Download now" button on the landing page. Phones get a real link to
 * their store (it works when popups are blocked and carries the deferred
 * hand-off); desktop gets the scan-to-download QR modal.
 */
export default function DownloadAppLink({
    surface,
    variant,
    className,
    buttonClassName,
}: {
    surface: MigrationSurface
    variant?: ButtonVariant
    className?: string
    buttonClassName?: string
}) {
    const t = useTranslations('migration')
    const { deviceType } = useDeviceType()
    const interceptAppCta = useAppModal()
    const store = storeForDevice(deviceType)
    // memoized: the sticky bar re-renders on scroll, and the android href
    // builds the hand-off payload from cookies
    const href = useMemo(() => (store ? storeAnchorHref(store) : '/app'), [store])
    return (
        <a
            href={href}
            target={store ? '_blank' : undefined}
            rel={store ? 'noopener noreferrer' : undefined}
            className={className}
            onClick={(event) => {
                if (store) onStoreAnchorClick(store, surface)
                else if (interceptAppCta(surface)) event.preventDefault()
            }}
        >
            <Button variant={variant} shadowSize="4" icon={storeIcon(store)} className={buttonClassName}>
                {t('downloadNow')}
            </Button>
        </a>
    )
}
