'use client'

import useGetExchangeRate from '@/hooks/useGetExchangeRate'
import { AccountType } from '@/interfaces/interfaces'
import { parsePlainPositiveRate } from '@/utils/fx.utils'
import { bankWithdrawMinNeedsRate, bankWithdrawMinUsd } from './amount-validation'

/** The Bridge rate query for a country's local-currency minimum (same key everywhere it is read). */
function bridgeRateAccountType(countryIso2: string): AccountType {
    if (countryIso2 === 'GB') return AccountType.GB
    if (countryIso2 === 'MX') return AccountType.CLABE
    if (countryIso2 === 'CO') return AccountType.CO_BANK_TRANSFER
    return AccountType.IBAN
}

/**
 * The USD minimum a Bridge bank withdrawal to `countryIso2` enforces, from
 * Bridge's own sell rate — the one source the widget, the amount step and the
 * bank submit all read, so none can accept an amount another refuses.
 *
 * - `ready`: `minUsd` is the enforced floor (fixed floors need no rate).
 * - `pending`: the rate has not arrived; nothing may proceed.
 * - `unavailable`: the rate request failed or was unusable; nothing may proceed.
 * `minUsd` is null unless `ready`. A null minimum never means "no minimum".
 */
export function useBankWithdrawMinimum(countryIso2: string, { enabled = true }: { enabled?: boolean } = {}) {
    const needsRate = bankWithdrawMinNeedsRate(countryIso2)
    const { exchangeRate, isError } = useGetExchangeRate({
        accountType: bridgeRateAccountType(countryIso2),
        enabled: enabled && needsRate,
    })

    if (!needsRate) return { minUsd: bankWithdrawMinUsd(countryIso2, null), status: 'ready' as const }
    if (!isError && parsePlainPositiveRate(exchangeRate) !== null) {
        return { minUsd: bankWithdrawMinUsd(countryIso2, exchangeRate), status: 'ready' as const }
    }
    return { minUsd: null, status: isError ? ('unavailable' as const) : ('pending' as const) }
}
