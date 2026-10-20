'use client'
import { useNativePlatform } from '@/utils/native-platform'
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import type { ButtonSize, ButtonVariant } from '@/components/0_Bruddle/Button'
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
    size,
    className,
}: {
    surface: MigrationSurface
    variant?: ButtonVariant
    /** marketing CTAs pass 'large' (design.md marketing); the sticky bar keeps the default */
    size?: ButtonSize
    className?: string
}) {
    const native = useNativePlatform()
    const t = useTranslations('migration')
    const { deviceType } = useDeviceType()
    const interceptAppCta = useAppModal()
    const store = storeForDevice(deviceType)
    // memoized: the sticky bar re-renders on scroll, and the android href
    // builds the hand-off payload from cookies
    const href = useMemo(
        () => (store ? storeAnchorHref(store, native.isCapacitor, native.isHydrated) : '/app'),
        [store, native.isCapacitor, native.isHydrated]
    )
    // link-mode Button: one anchor carrying the button look (design.md — never
    // a Button nested in an <a>). plainAnchor keeps the native full-load /app
    // fallback for clicks the modal does not take.
    return (
        <Button
            href={href}
            plainAnchor
            target={store ? '_blank' : undefined}
            rel={store ? 'noopener noreferrer' : undefined}
            onClick={(event) => {
                if (store) onStoreAnchorClick(store, surface)
                else if (interceptAppCta(surface)) event.preventDefault()
            }}
            variant={variant}
            size={size}
            icon={storeIcon(store)}
            className={className}
        >
            {t('downloadNow')}
        </Button>
    )
}
