import { apiFetch } from '@/utils/api-fetch'
import { AccountType } from '@/interfaces/interfaces'

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
        const params = new URLSearchParams({ accountType })
        if (sourceAmount !== undefined) {
            params.append('sourceAmount', String(sourceAmount))
        }

        // apiFetch awaits authReady() (guarded mode holds it until unlock) and
        // attaches the session token, so this caller never fires unauthenticated.
        const response = await apiFetch(`/bridge/onramp/quote?${params.toString()}`, { method: 'GET' })

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
