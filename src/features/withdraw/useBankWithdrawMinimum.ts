'use client'

import { useBridgeOfframpQuote } from '@/hooks/useBridgeOfframpQuote'
import { getMinimumAmount, getOfframpCurrencyConfig } from '@/utils/bridge.utils'
import { parsePlainPositiveRate } from '@/utils/fx.utils'
import { BRIDGE_OFFRAMP_MIN_USD, usdForBankPayoutMinimum } from './amount-validation'

/**
 * The USD minimum Rates & fees shows for a Bridge bank withdrawal to
 * `countryIso2`. The withdraw flows compare the same payout minimum in the
 * bank's currency (`meetsBankPayoutMinimum`); this is that minimum in USD,
 * rounded up to the cent.
 *
 * The rate is the one the withdrawal itself converts with: the Bridge offramp
 * quote (useBridgeOfframpQuote), refreshed every 30 seconds — not the
 * longer-cached display rate, which let an old rate under-state the minimum.
 *
 * - `ready`: `minUsd` is the floor (fixed floors need no rate).
 * - `pending`: no quote yet; nothing may proceed.
 * - `unavailable`: the quote failed, or its last refresh failed; nothing may proceed.
 * `minUsd` is null unless `ready`. A null minimum never means "no minimum".
 */
export function useBankWithdrawMinimum(countryIso2: string, { enabled = true }: { enabled?: boolean } = {}) {
    // GB £3, MX 50 MXN and CO 4,000 COP are in the bank's currency; every other
    // country has the $1 floor
    const bankMinimum = getMinimumAmount(countryIso2)
    const needsRate = bankMinimum > BRIDGE_OFFRAMP_MIN_USD
    const { quote, isError } = useBridgeOfframpQuote({
        currency: needsRate ? getOfframpCurrencyConfig(countryIso2).currency : null,
        enabled,
    })

    if (!needsRate) return { minUsd: BRIDGE_OFFRAMP_MIN_USD, status: 'ready' as const }
    // a quote whose refresh failed is kept for display elsewhere, but it is not current
    if (isError) return { minUsd: null, status: 'unavailable' as const }
    if (!quote) return { minUsd: null, status: 'pending' as const }
    const rate = parsePlainPositiveRate(quote.rate)
    if (rate === null) return { minUsd: null, status: 'unavailable' as const }
    return { minUsd: usdForBankPayoutMinimum(bankMinimum, rate), status: 'ready' as const }
}
