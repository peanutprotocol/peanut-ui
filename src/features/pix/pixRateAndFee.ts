import type { ProviderId } from '@/types/provider.types'

/**
 * The exchange rate and the provider fee the API sends as two rows that reconcile with the amounts:
 * BRL per USD with the providers' variable fees inside, and the flat fee per Pix in reais (TASK-24967).
 * Deposit: (amountBrl − providerFeeBrl) ÷ exchangeRate = USD credited.
 * Payout: USD sent × exchangeRate − providerFeeBrl = amountBrl.
 */
export type PixRateAndFee = { exchangeRate: number; providerFeeBrl: string }

/** The pair from an API answer, or null: the API sends both or neither, and one alone is not shown. */
export function pixRateAndFee(
    source: { exchangeRate?: string; providerFeeBrl?: string } | null | undefined
): PixRateAndFee | null {
    if (!source?.exchangeRate || !source.providerFeeBrl) return null
    const exchangeRate = Number(source.exchangeRate)
    return exchangeRate > 0 && Number.isFinite(Number(source.providerFeeBrl))
        ? { exchangeRate, providerFeeBrl: source.providerFeeBrl }
        : null
}

/**
 * Whether a Pix screen shows the API's rate and fee rows: on Avenia the rate with the variable fees
 * inside and the flat fee as the "Provider fee" row (TASK-24967), or neither row when the API sends
 * neither; never a rate worked out from the amounts. Manteca keeps the rows it had.
 * The wire names no such capability, so the route's provider decides (`pixProviderId`).
 */
export const showsProviderRateAndFee = (providerId: ProviderId | null): boolean => providerId === 'avenia-br'
