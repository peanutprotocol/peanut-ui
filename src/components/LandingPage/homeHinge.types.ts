import type { ReactNode } from 'react'
import type { Locale } from '@/i18n/types'

/** Copy for the balance hinge fold (f5). */
export interface HomeHingeStrings {
    /** "Your earnings, ready to use." */
    heading: string
    /** "Balance", over the big amount on the drawn screen */
    balance: string
    /** "Activity", over the two rows */
    activity: string
    /** "Money in", the title of the SEPA row */
    moneyIn: string
    /** The drawn screen's accessible name:
        "… {balance} … {eur}, {usdIn} … {merchant}: {ars}, {usdOut}." */
    screenLabel: string
}

export interface HomeHingeFoldProps {
    strings: HomeHingeStrings
    locale: Locale
}

export type HomeBalanceScreenProps = HomeHingeFoldProps

/** Money into the balance, or out of it. */
export type HomeBalanceTone = 'in' | 'out'

export interface HomeBalanceActivityRowProps {
    /** The round badge's content: a currency sign or a payment-app mark. */
    icon: ReactNode
    title: string
    /** The rail and the original amount ("SEPA · €1,500.00"). */
    detail: string
    /** The signed dollar amount, already formatted. */
    amount: string
    tone: HomeBalanceTone
}
