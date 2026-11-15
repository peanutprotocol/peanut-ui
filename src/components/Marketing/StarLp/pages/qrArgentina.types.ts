import type { ReactNode } from 'react'
import type { StarLpFxReading } from '@/components/Marketing/StarLp/starLp.types'

export interface QrArgentinaReviewProps {
    /** USD→ARS (Manteca sell) with its tier. Only a live rate reaches the screen; otherwise the rate row says when it shows. */
    usdArs: StarLpFxReading
}

export interface QrArgentinaGroupChatProps {
    /** USD→ARS with its tier: the chat's request is one diner's share of the bill at this rate. */
    usdArs: StarLpFxReading
}

export interface QrArgentinaRateFoldProps {
    /** USD→ARS (Manteca sell) with its tier for the rate line: the exact rate, "≈" a rounded last-known one, or "Best rate". */
    usdArs: StarLpFxReading
}

export interface QrArgentinaRateHeadlineData {
    /** "$1 =" over a live rate, "$1 ≈" over a last-known one. */
    lead: string
    /** The value the rate line prints: the live rate, or the last-known one rounded to the nearest 10. */
    rate: number
    /** As printed, e.g. "1,596.75" (live) or "1,600" (last-known). */
    value: string
    /** What screen readers hear, once. */
    label: string
    /** A container-width font size that fits the number to the column. */
    fontSize: string
    /** Only a live rate counts up: a rounded one has no digits to climb through. */
    countsUp: boolean
}

export interface QrArgentinaRateHeadlineProps {
    headline: QrArgentinaRateHeadlineData
    /** The number on screen now, printed: below `headline.value` while counting up. */
    shown: string
    /** The number's line, which the count-up watches for its scroll-in. */
    numberRef: (node: HTMLElement | null) => void
}

export interface QrArgentinaRateCountUp {
    ref: (node: HTMLElement | null) => void
    /** The rate to print now; `null` without a live rate. */
    shown: number | null
}

export interface QrArgentinaAppLinkProps {
    children: ReactNode
    className?: string
}

export interface QrArgentinaScanFrameProps {
    children: ReactNode
    /** false keeps the frame still round its content: no scan line and no "detected" pulse, only the corners locking in. Default true. */
    scanLine?: boolean
    /** Merged onto the frame, e.g. a wider width to frame two stickers. */
    className?: string
}
