import { getExchangeRate } from './exchange-rate'
import { AccountType } from '@/interfaces'
import { mantecaApi } from '@/services/manteca'
import { unstable_cache } from '@/utils/no-cache'

const MANTECA_CURRENCIES = ['ARS', 'BRL', 'COP', 'CRC', 'PUSD', 'GTQ', 'PHP', 'BOB']
const BRIDGE_CURRENCIES = ['EUR', 'MXN', 'GBP']
const BRIDGE_ACCOUNT_TYPE: Record<string, AccountType> = {
    EUR: AccountType.IBAN,
    MXN: AccountType.CLABE,
    GBP: AccountType.GB,
}

const assertPositiveRate = (label: string, rate: number): number => {
    if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error(`Invalid ${label} rate from provider: ${rate}`)
    }
    return rate
}

const fetchCurrencyPrice = async (currencyCode: string): Promise<{ buy: number; sell: number }> => {
    if (currencyCode === 'USD') return { buy: 1, sell: 1 }

    if (BRIDGE_CURRENCIES.includes(currencyCode)) {
        const { data, error } = await getExchangeRate(BRIDGE_ACCOUNT_TYPE[currencyCode])
        if (error) throw new Error('Failed to fetch exchange rate from bridge')
        if (!data) throw new Error('No data returned from exchange rate API')
        return {
            buy: assertPositiveRate('buy', parseFloat(data.buy_rate)),
            sell: assertPositiveRate('sell', parseFloat(data.sell_rate)),
        }
    }

    if (MANTECA_CURRENCIES.includes(currencyCode)) {
        const response = await mantecaApi.getPrices({ asset: 'USDC', against: currencyCode })
        // Manteca moved the effective rate under `effectivePrice.{buy,sell}` on 2026-07-01
        // (previously top-level `effectiveBuy`/`effectiveSell`). Read the new shape first and
        // fall back to the legacy fields so a provider rollback can't re-break pricing.
        const effectiveBuy = response.effectivePrice?.buy ?? response.effectiveBuy
        const effectiveSell = response.effectivePrice?.sell ?? response.effectiveSell
        return {
            buy: assertPositiveRate('buy', Number(effectiveBuy)),
            sell: assertPositiveRate('sell', Number(effectiveSell)),
        }
    }

    throw new Error('Invalid currency code')
}

/**
 * Live FX quote — no caching. Use this on commit paths where the returned
 * value is multiplied into an `amount` sent to a provider (on-ramp create,
 * QR payment quote). A stale rate here translates directly into the user
 * receiving more/less USDC than displayed.
 */
export const getCurrencyPrice = (currencyCode: string): Promise<{ buy: number; sell: number }> =>
    fetchCurrencyPrice(currencyCode.toUpperCase())

const cachedFetch = unstable_cache(fetchCurrencyPrice, ['getCurrencyPrice'], { revalidate: 60 })

/**
 * 60s in-memory cached FX quote. Use for display surfaces (currency picker,
 * exchange-rate widget, history rows). Never use on a code path that
 * forwards the result as an `amount` to a provider — use `getCurrencyPrice`.
 */
export const getCachedCurrencyPrice = (currencyCode: string): Promise<{ buy: number; sell: number }> =>
    cachedFetch(currencyCode.toUpperCase())
