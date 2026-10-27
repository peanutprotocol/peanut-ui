import type { StaticImageData } from 'next/image'
import type { ReactNode } from 'react'
import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'
import type { MigrationSurface } from '@/constants/migration.consts'

/** One real bank-details capture in the hero pair. */
export interface UsEuAccountCaptureProps {
    src: StaticImageData
    /** Resting tilt in degrees. */
    tilt: number
    /** Delay of the drop-in, in seconds. */
    delay: number
    /** The currency sign stuck on the card ('$' or '€'), so the two captures tell apart at a glance. */
    badge: string
    /** The outer corner the sign sits on: the ones clear of the Knerd above and of the other card. */
    badgeCorner: 'bottom-left' | 'top-right'
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
    /** Analytics surface of the click; STAR_LP by default. */
    surface?: MigrationSurface
}

/** The hero pair of bank-details captures, as art that links to the accounts screen. */
export interface UsEuAccountPairProps {
    /** The USD capture; the English fixture by default. */
    usdSrc?: StaticImageData
    /** The EUR capture; the English fixture by default. */
    eurSrc?: StaticImageData
    /** Merged onto the link wrapper, e.g. to cap the pair to a half column. */
    className?: string
    /** Analytics surface of the click; STAR_LP by default. */
    surface?: MigrationSurface
}

/** The words on the request strips, in the page language. `{username}` in `requesting`,
    and `{main}`, `{payer}`, `{amount}` in `chatLabel`, are filled in by the strips. */
export interface UsEuRequestStripsLabels {
    /** Small line over the link, e.g. "{username} is requesting". */
    requesting: string
    /** The last strip's word, e.g. "Paid". */
    paid: string
    /** The payer's question. Omit and the strips start at the link: two beats, not three. */
    ask?: string
    /** Accessible name of the whole picture. */
    chatLabel: string
}

export interface UsEuRequestStripsProps {
    /** Leave out on /us-europe-accounts: its English copy is the default. */
    labels?: UsEuRequestStripsLabels
    /** false renders the request strip without its link, for a fold with no CTA
        (the strips are aria-hidden, so a link there would be unreachable). Default true. */
    linked?: boolean
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
