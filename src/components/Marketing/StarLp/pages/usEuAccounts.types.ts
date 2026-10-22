import type { StaticImageData } from 'next/image'
import type { ReactNode } from 'react'
import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'

/** One real bank-details capture in the hero pair. */
export interface UsEuAccountCaptureProps {
    src: StaticImageData
    /** Resting tilt in degrees. */
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

/** A plain link that goes where the page CTA goes, download modal included. */
export interface UsEuAppLinkProps {
    href: string
    /** Where a signed-in visitor goes instead, as on StarLpCta. */
    signedInHref?: string
    children: ReactNode
    className?: string
}

/** A strip's ground: white for the payer's ask, pink for the request, green once paid. */
export type UsEuStripTone = 'white' | 'pink' | 'green'

/** One tilted strip in the request fold: a disc with the speaker's initial, who speaks, what they say. */
export interface UsEuStripProps {
    tone: UsEuStripTone
    /** The disc's letter. */
    initial: string
    /** The small line above the message, e.g. "Mengano" or "fulano is requesting". */
    who: string
    /** Optional art at the strip's right end from xl (the Knerd amount); below xl it sits between `who` and the message. */
    aside?: ReactNode
    /** Resting tilt and offset; the strip only fades in, so the tilt never animates. */
    className?: string
    children: ReactNode
}

/** The live EUR→USD quote for the money-in push, or null when there is no live rate. */
export interface UsEuFxProps {
    eurUsd: StarLpFxRate | null
}
