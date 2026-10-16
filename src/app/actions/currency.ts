import { getExchangeRate } from './exchange-rate'
import { AccountType } from '@/interfaces/interfaces'
import { mantecaApi } from '@/services/manteca'
import { unstable_cache } from '@/utils/no-cache'
import * as Sentry from '@/utils/sentry-lazy'
import { BRIDGE_CURRENCIES, MANTECA_CURRENCIES } from '@/constants/quotable-currencies.consts'

const BRIDGE_ACCOUNT_TYPE: Record<string, AccountType> = {
    EUR: AccountType.IBAN,
    MXN: AccountType.CLABE,
    GBP: AccountType.GB,
}

type FxProvider = 'bridge' | 'manteca'
export type FxFailure = 'timeout' | 'network' | 'http' | 'invalid_rate'

/*
 * A provider quote that could not be used. It deliberately carries no `cause`:
 * a transport wrapper in the chain matches Sentry's `alreadyReported` group and
 * an engine "Failed to fetch" matches `networkIssues`, and either would drop
 * the one report filed for this request.
 */
export class FxRateUnavailableError extends Error {
    constructor(
        readonly provider: FxProvider,
        readonly currency: string,
        readonly failure: FxFailure,
        readonly status?: number
    ) {
        super(`FX rate unavailable from ${provider} (${failure})`)
        this.name = 'FxRateUnavailableError'
    }
}

function reportFxFailure(error: FxRateUnavailableError): void {
    Sentry.withScope((scope) => {
        scope.setFingerprint(['fx-rate-unavailable', error.provider, error.failure])
        scope.setTag('fx.provider', error.provider)
        scope.setTag('fx.currency', error.currency)
        scope.setTag('fx.failure', error.failure)
        if (error.status !== undefined) scope.setTag('http.status_code', String(error.status))
        const ours = error.failure === 'invalid_rate' || (error.status ?? 0) >= 500
        Sentry.captureException(error, { level: ours ? 'error' : 'warning' })
    })
}

const transportFailure = (error: unknown): FxFailure =>
    error instanceof Error && error.name === 'ConnectionTimeoutError' ? 'timeout' : 'network'

const assertPositiveRate = (provider: FxProvider, currency: string, rate: number): number => {
    if (!Number.isFinite(rate) || rate <= 0) {
        throw new FxRateUnavailableError(provider, currency, 'invalid_rate')
    }
    return rate
}

const quoteBridge = async (currencyCode: string): Promise<{ buy: number; sell: number }> => {
    const { data, error, status, failure } = await getExchangeRate(BRIDGE_ACCOUNT_TYPE[currencyCode], {
        callerReportsFailures: true,
    })
    if (error || !data) {
        throw new FxRateUnavailableError('bridge', currencyCode, failure ?? (error ? 'http' : 'invalid_rate'), status)
    }
    return {
        buy: assertPositiveRate('bridge', currencyCode, parseFloat(data.buy_rate)),
        sell: assertPositiveRate('bridge', currencyCode, parseFloat(data.sell_rate)),
    }
}

const quoteManteca = async (currencyCode: string): Promise<{ buy: number; sell: number }> => {
    let response: Awaited<ReturnType<typeof mantecaApi.getPrices>>
    try {
        response = await mantecaApi.getPrices({ asset: 'USDC', against: currencyCode }, { callerReportsFailures: true })
    } catch (error) {
        const status = (error as { status?: unknown } | null)?.status
        if (typeof status === 'number') throw new FxRateUnavailableError('manteca', currencyCode, 'http', status)
        const failure = error instanceof SyntaxError ? 'invalid_rate' : transportFailure(error)
        throw new FxRateUnavailableError('manteca', currencyCode, failure)
    }
    // Manteca moved the effective rate under `effectivePrice.{buy,sell}` on 2026-07-01
    // (previously top-level `effectiveBuy`/`effectiveSell`). Read the new shape first and
    // fall back to the legacy fields so a provider rollback can't re-break pricing.
    const effectiveBuy = response.effectivePrice?.buy ?? response.effectiveBuy
    const effectiveSell = response.effectivePrice?.sell ?? response.effectiveSell
    return {
        buy: assertPositiveRate('manteca', currencyCode, Number(effectiveBuy)),
        sell: assertPositiveRate('manteca', currencyCode, Number(effectiveSell)),
    }
}

// Display consumers share one in-flight call, so this reports once per provider request.
const fetchCurrencyPrice = async (currencyCode: string): Promise<{ buy: number; sell: number }> => {
    if (currencyCode === 'USD') return { buy: 1, sell: 1 }

    const quote = BRIDGE_CURRENCIES.includes(currencyCode)
        ? quoteBridge
        : MANTECA_CURRENCIES.includes(currencyCode)
          ? quoteManteca
          : null
    if (!quote) throw new Error('Invalid currency code')

    try {
        return await quote(currencyCode)
    } catch (error) {
        if (error instanceof FxRateUnavailableError) reportFxFailure(error)
        throw error
    }
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
