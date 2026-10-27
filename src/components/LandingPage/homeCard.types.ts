import type { ReactNode } from 'react'
import type { Locale } from '@/i18n/types'

/** Copy for the Peanut Card fold (f6). */
export interface HomeCardStrings {
    /** "Peanut Card": the brand name, the same in every locale */
    lockup: string
    /** "In dollars.", the h2's second sentence */
    tagline: string
    /** "Spend your Peanut balance with a Visa Platinum card." */
    line: string
    /** "Get your card" */
    cta: string
    /** "Card purchase", the receipt's kicker */
    receiptTitle: string
    /** "Approved", beside the green tick */
    receiptApproved: string
}

export interface HomeCardFoldProps {
    strings: HomeCardStrings
    locale: Locale
}

export type HomeCardReceiptProps = HomeCardFoldProps

export interface HomeCardGateProps {
    children: ReactNode
}
