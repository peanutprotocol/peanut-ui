import type { ReactNode } from 'react'
import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'

export interface QrArgentinaReviewProps {
    /** Live USD→ARS (Manteca sell). `null` hides the dollar line and the rate row. */
    usdArs: StarLpFxRate | null
}

export interface QrArgentinaRateFoldProps {
    /** Live USD→ARS (Manteca sell). `null` shows the fallback title. */
    usdArs: StarLpFxRate | null
}

export interface QrArgentinaRateHeadlineData {
    /** The live rate the count-up lands on. */
    rate: number
    /** The live rate as printed, e.g. "1,596.75". */
    value: string
    /** A container-width font size that fits the number to the column. */
    fontSize: string
}

export interface QrArgentinaRateHeadlineProps {
    headline: QrArgentinaRateHeadlineData
    /** The rate on screen now: below `headline.rate` while counting up. */
    shown: number
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
