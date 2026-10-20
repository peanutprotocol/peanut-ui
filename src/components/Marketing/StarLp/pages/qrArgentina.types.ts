import type { ReactNode } from 'react'
import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'

export interface QrArgentinaReviewProps {
    /** Live USD→ARS (Manteca sell). `null` hides the dollar line and the rate row. */
    usdArs: StarLpFxRate | null
}

export interface QrArgentinaAppLinkProps {
    children: ReactNode
    className?: string
}
