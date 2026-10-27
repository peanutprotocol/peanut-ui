'use client'

import { LandingAppLink } from '@/components/LandingPage/LandingAppLink'
import { CTA_MOTION } from '@/components/Marketing/constants'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { useAuth } from '@/context/authContext'
import { COLOURED_GROUNDS } from './starLp.consts'
import type { StarLpCtaProps } from './starLp.types'

/**
 * The star-LP CTA: the DS large Button sized to its label, with the marketing
 * motion layer. White secondary on a coloured band, pink primary on cream,
 * white and black (design.md § marketing components). It follows the
 * PWA-sunset flag through LandingAppLink, so it needs StarLpPage's
 * AppModalProvider above it.
 */
export function StarLpCta({ href, signedInHref, ground, children, qrPlacement }: StarLpCtaProps) {
    const { user } = useAuth()
    const destination = user && signedInHref ? signedInHref : href
    return (
        <LandingAppLink
            href={destination}
            surface={MIGRATION_SURFACES.STAR_LP}
            qrPlacement={qrPlacement}
            variant={COLOURED_GROUNDS.includes(ground) ? 'secondary' : 'primary'}
            size="large"
            className={`w-fit ${CTA_MOTION}`}
        >
            {children}
        </LandingAppLink>
    )
}
