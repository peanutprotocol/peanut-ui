'use client'

import { useOfframpRate } from '@/hooks/useOfframpRate'
import { parsePlainPositiveRate } from '@/utils/fx.utils'
import { bankWithdrawMinNeedsRate, bankWithdrawMinUsd } from './amount-validation'

/** The payout currency behind a country's local-currency minimum (same query everywhere it is read). */
function payoutCurrency(countryIso2: string): string {
    if (countryIso2 === 'GB') return 'GBP'
    if (countryIso2 === 'MX') return 'MXN'
    if (countryIso2 === 'CO') return 'COP'
    return 'EUR'
}

/**
 * The USD minimum a Bridge bank withdrawal to `countryIso2` enforces, from
 * the rate the withdrawal is quoted at (the public offramp rate: Peanut's FX
 * margin inside while collected, Bridge's own rate while it is off) — the one
 * source the widget, the amount step and the bank submit all read, so none
 * can accept an amount another refuses. A USD minimum from Bridge's gross
 * rate would let through a payout under the rail's local floor.
 *
 * - `ready`: `minUsd` is the enforced floor (fixed floors need no rate).
 * - `pending`: the rate has not arrived; nothing may proceed.
 * - `unavailable`: the rate request failed or was unusable; nothing may proceed.
 * `minUsd` is null unless `ready`. A null minimum never means "no minimum".
 *
 * `quote`: a flow that holds the account's Bridge offramp quote (the amount
 * step and review of a GBP, MXN or COP account) passes it, and the minimum
 * converts with the rate the amount itself converts with; the public rate is
 * then not fetched. A quote whose refresh failed is `unavailable` — never a
 * retained rate.
 */
export function useBankWithdrawMinimum(
    countryIso2: string,
    { enabled = true, quote }: { enabled?: boolean; quote?: { rate: string | null | undefined; isError: boolean } } = {}
) {
    const needsRate = bankWithdrawMinNeedsRate(countryIso2)
    const publicRate = useOfframpRate(payoutCurrency(countryIso2), { enabled: enabled && needsRate && !quote })

    if (!needsRate) return { minUsd: bankWithdrawMinUsd(countryIso2, null), status: 'ready' as const }
    if (quote) {
        if (!quote.isError && parsePlainPositiveRate(quote.rate) !== null) {
            return { minUsd: bankWithdrawMinUsd(countryIso2, quote.rate), status: 'ready' as const }
        }
        return { minUsd: null, status: quote.isError ? ('unavailable' as const) : ('pending' as const) }
    }
    if (publicRate.rate !== null) {
        return { minUsd: bankWithdrawMinUsd(countryIso2, String(publicRate.rate)), status: 'ready' as const }
    }
    return { minUsd: null, status: publicRate.isError ? ('unavailable' as const) : ('pending' as const) }
}
