'use client'

import useGetExchangeRate from '@/hooks/useGetExchangeRate'
import { AccountType } from '@/interfaces/interfaces'
import { getMinimumAmount } from '@/utils/bridge.utils'
import { parsePlainPositiveRate } from '@/utils/fx.utils'
import { BRIDGE_OFFRAMP_MIN_USD, usdForBankPayoutMinimum } from './amount-validation'

/** The Bridge rate query for a country's local-currency minimum (same key everywhere it is read). */
function bridgeRateAccountType(countryIso2: string): AccountType {
    if (countryIso2 === 'GB') return AccountType.GB
    if (countryIso2 === 'MX') return AccountType.CLABE
    if (countryIso2 === 'CO') return AccountType.CO_BANK_TRANSFER
    return AccountType.IBAN
}

/**
 * The USD minimum Rates & fees shows for a Bridge bank withdrawal to
 * `countryIso2`, from Bridge's own sell rate. The withdraw flows compare the
 * same payout minimum in the bank's currency (`meetsBankPayoutMinimum`); this
 * is that minimum in USD, rounded up to the cent.
 *
 * - `ready`: `minUsd` is the floor (fixed floors need no rate).
 * - `pending`: the rate has not arrived; nothing may proceed.
 * - `unavailable`: the rate request failed or was unusable; nothing may proceed.
 * `minUsd` is null unless `ready`. A null minimum never means "no minimum".
 */
export function useBankWithdrawMinimum(countryIso2: string, { enabled = true }: { enabled?: boolean } = {}) {
    // GB £3, MX 50 MXN and CO 4,000 COP are in the bank's currency; every other
    // country has the $1 floor
    const bankMinimum = getMinimumAmount(countryIso2)
    const needsRate = bankMinimum > BRIDGE_OFFRAMP_MIN_USD
    const { exchangeRate, isError } = useGetExchangeRate({
        accountType: bridgeRateAccountType(countryIso2),
        enabled: enabled && needsRate,
    })

    if (!needsRate) return { minUsd: BRIDGE_OFFRAMP_MIN_USD, status: 'ready' as const }
    const rate = parsePlainPositiveRate(exchangeRate)
    if (!isError && rate !== null) {
        return { minUsd: usdForBankPayoutMinimum(bankMinimum, rate), status: 'ready' as const }
    }
    return { minUsd: null, status: isError ? ('unavailable' as const) : ('pending' as const) }
}
