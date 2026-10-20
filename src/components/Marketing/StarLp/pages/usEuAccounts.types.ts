import type { StaticImageData } from 'next/image'
import type { ReactNode } from 'react'
import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'

/** One real bank-details capture in the hero pair. */
export interface UsEuAccountCaptureProps {
    src: StaticImageData
    /** Resting tilt in degrees; a hover or tap swings it the other way. */
    tilt: number
    /** Delay of the drop-in, in seconds. */
    delay: number
    className?: string
}

/** One row of the How it works timeline: a clock time beside a drawn moment. */
export interface UsEuTimelineRowProps {
    time: string
    children: ReactNode
}

/** The live EUR→USD rate, or null when it could not be read (the USD figure is then hidden). */
export interface UsEuFxProps {
    eurUsd: StarLpFxRate | null
}

/** A plain link that goes where the page CTA goes, download modal included. */
export interface UsEuAppLinkProps {
    href: string
    /** Where a signed-in visitor goes instead, as on StarLpCta. */
    signedInHref?: string
    children: ReactNode
    className?: string
}
