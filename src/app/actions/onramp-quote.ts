'use server'

import { fetchWithSentry } from '@/utils/sentry.utils'
import { AccountType } from '@/interfaces'

const API_KEY = process.env.PEANUT_API_KEY!

export interface OnrampQuoteResponse {
    from: string
    to: string
    /** Raw Bridge rate (source → destination) before Peanut fee. */
    grossRate: string
    /** Rate the user actually receives, net of Peanut's developer fee. */
    netRate: string
    /** Peanut developer fee as a fraction string (e.g. "0.005"). */
    peanutFee: string
    updatedAt: string
    /** Net-amount projection when `sourceAmount` was supplied. */
    netAmount?: string
}

/**
 * Onramp quote — returns the rate + amount a user actually receives for a
 * fiat-in → USDC-out flow, with Peanut's 50bps developer fee applied on top
 * of Bridge's published FX rate. Use instead of `getExchangeRate` anywhere
 * the UI needs the true "Recipient Gets" number.
 */
export async function getOnrampQuote(
    accountType: AccountType,
    sourceAmount?: number
): Promise<{ data?: OnrampQuoteResponse; error?: string }> {
    const apiUrl = process.env.PEANUT_API_URL

    if (!apiUrl || !API_KEY) {
        return { error: 'Server configuration error.' }
    }

    try {
        const url = new URL(`${apiUrl}/bridge/onramp/quote`)
        url.searchParams.append('accountType', accountType)
        if (sourceAmount !== undefined) {
            url.searchParams.append('sourceAmount', String(sourceAmount))
        }

        const response = await fetchWithSentry(url.toString(), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'api-key': API_KEY },
        })

        const data = await response.json()
        if (!response.ok) {
            return { error: data.error || 'Failed to fetch onramp quote.' }
        }
        return { data }
    } catch (error) {
        if (error instanceof Error) return { error: error.message }
        return { error: 'An unexpected error occurred.' }
    }
}
