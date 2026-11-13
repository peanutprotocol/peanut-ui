'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { CTA_MOTION } from '@/components/Marketing/constants'
import DownloadAppLink from '@/components/Migration/DownloadAppLink'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useOptionalAuth } from '@/context/authContext'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { COLOURED_GROUNDS } from './starLp.consts'
import type { StarLpCtaProps } from './starLp.types'

/**
 * The star-LP CTA: the DS large Button sized to its label, with the marketing
 * motion layer. White secondary on a coloured band, pink primary on cream,
 * white and black (design.md § marketing components). With the PWA-sunset
 * flag on it is the marketing download CTA (DownloadAppLink: store link on
 * phones, QR modal on desktop), so it needs StarLpPage's AppModalProvider
 * above it. With the flag off it links to `href` (web signup).
 */
export function StarLpCta({
    href,
    signedInHref,
    ground,
    children,
    qrPlacement,
    surface = MIGRATION_SURFACES.STAR_LP,
}: StarLpCtaProps) {
    const migrationOn = useMigrationFlag()
    // the homepage renders these with no AuthProvider above it: there every visitor gets the guest href
    const user = useOptionalAuth()?.user
    const variant = COLOURED_GROUNDS.includes(ground) ? 'secondary' : 'primary'
    const className = `w-fit ${CTA_MOTION}`
    if (migrationOn) {
        return (
            <DownloadAppLink
                surface={surface}
                qrPlacement={qrPlacement}
                variant={variant}
                size="large"
                className={className}
            >
                {children}
            </DownloadAppLink>
        )
    }
    return (
        <Button
            prefetch={false}
            href={user && signedInHref ? signedInHref : href}
            variant={variant}
            size="large"
            className={className}
        >
            {children}
        </Button>
    )
}
