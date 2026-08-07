import { fetchWithSentry } from '@/utils/sentry.utils'
import { AccountType } from '@/interfaces/interfaces'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { authReady, getAuthHeaders } from '@/utils/auth-token'

export interface OnrampQuoteResponse {
    from: string
    to: string
    /** Raw Bridge rate (source → destination) before Peanut fee. */
    grossRate: string
    /** Rate net of Peanut's developer fee — the fee is currently 0, so identical to grossRate. */
    netRate: string
    /** Peanut developer fee as a fraction string — currently "0.0000". */
    peanutFee: string
    updatedAt: string
    /** Net-amount projection when `sourceAmount` was supplied. */
    netAmount?: string
}

/**
 * Onramp quote — returns the rate + amount a user actually receives for a
 * fiat-in → USDC-out flow. Use instead of `getExchangeRate` anywhere the UI
 * needs the true "Recipient Gets" number: this quotes the deposit-execution
 * side, while the exchange-rate display surfaces quote the withdrawal side.
 * The net/gross split exists for the planned FX-margin re-enable; the fee is
 * currently 0.
 */
export async function getOnrampQuote(
    accountType: AccountType,
    sourceAmount?: number
): Promise<{ data?: OnrampQuoteResponse; error?: string }> {
    try {
        const url = new URL(`${PEANUT_API_URL}/bridge/onramp/quote`)
        url.searchParams.append('accountType', accountType)
        if (sourceAmount !== undefined) {
            url.searchParams.append('sourceAmount', String(sourceAmount))
        }

        // park until the session token can legitimately be read (guarded mode
        // holds this until unlock) so this caller never fires unauthenticated
        await authReady()
        const response = await fetchWithSentry(url.toString(), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
