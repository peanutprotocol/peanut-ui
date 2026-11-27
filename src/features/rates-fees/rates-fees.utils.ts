import type { SupportedExchangeCurrency } from '@/constants/exchange-currencies.consts'
import type { FxFeeSchedule } from '@/utils/fx.utils'

export type RatesDirection = 'add' | 'withdraw'

/** Fallback display order when no user residence matches a supported local rail (EUR first; USD 1:1 kept). */
const DEFAULT_CURRENCY_ORDER: readonly SupportedExchangeCurrency[] = ['EUR', 'ARS', 'BRL', 'USD', 'GBP', 'MXN', 'COP']

const COUNTRY_TO_CURRENCY: Readonly<Record<string, SupportedExchangeCurrency>> = {
    AR: 'ARS',
    BR: 'BRL',
    MX: 'MXN',
    CO: 'COP',
    GB: 'GBP',
    UK: 'GBP',
    US: 'USD',
}

/** Currencies that support QR payments in addition to bank withdrawals. */
export const QR_ENABLED_CURRENCIES: ReadonlySet<SupportedExchangeCurrency> = new Set(['ARS', 'BRL'])

/** Currencies with local-market USD benchmarks (`GET /fx/reference`). */
export const BENCHMARK_CURRENCIES: ReadonlySet<SupportedExchangeCurrency> = new Set(['ARS'])

/** Rate display decimals: 4 on EUR/GBP so small spreads stay legible, 0 on COP, 2 on others. */
export const RATE_DECIMALS: Readonly<Record<SupportedExchangeCurrency, number>> = {
    ARS: 2,
    EUR: 4,
    USD: 2,
    GBP: 4,
    MXN: 2,
    COP: 0,
    BRL: 2,
}

export const DEFAULT_INPUT_AMOUNT: Readonly<Record<SupportedExchangeCurrency, string>> = {
    ARS: '100000',
    EUR: '500',
    USD: '500',
    GBP: '500',
    MXN: '5000',
    COP: '500000',
    BRL: '500',
}

export function defaultCurrencyForCountry(countryCode: string | null | undefined): SupportedExchangeCurrency {
    const normalized = countryCode?.trim().toUpperCase()
    if (normalized && Object.hasOwn(COUNTRY_TO_CURRENCY, normalized)) {
        return COUNTRY_TO_CURRENCY[normalized]
    }
    return 'EUR'
}

/**
 * Adaptable currency order: puts the user's primary local currency first
 * (`AR → ARS`, `BR → BRL`, otherwise `EUR` first), keeping `USD` (1:1) visible.
 */
export function getOrderedCurrencies(countryCode: string | null | undefined): SupportedExchangeCurrency[] {
    const primary = defaultCurrencyForCountry(countryCode)
    return [primary, ...DEFAULT_CURRENCY_ORDER.filter((code) => code !== primary)]
}

/**
 * Pure bilateral conversion:
 * - `add`: local currency → USD balance (subtracts any flat local-currency fee before converting).
 * - `withdraw`: USD balance → local currency.
 */
export function convertCurrencyAmount(params: {
    amount: number
    rate: number
    direction: RatesDirection
    flatFeeLocal?: number
}): number {
    const { amount, rate, direction, flatFeeLocal = 0 } = params
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate <= 0) return 0
    if (direction === 'add') {
        return Math.max(0, (amount - flatFeeLocal) / rate)
    }
    return amount * rate
}

/** Parse a user-typed decimal string respecting either `.` or `,` decimal separators. */
export function parseLocaleAmount(raw: string, locale: string): number {
    const cleaned = raw.replace(/[^\d.,]/g, '')
    if (!cleaned) return 0
    const usesCommaDecimal = locale.startsWith('es') || locale.startsWith('pt')
    const normalized = usesCommaDecimal ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '')
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

/**
 * Static fallback mirroring `peanut-api-ts/src/fx/fees.ts` so the Fees tab stays
 * accurate if `/fx/fees` has not rolled out to an environment yet or times out.
 */
export const FALLBACK_FEE_SCHEDULE: FxFeeSchedule = {
    bankTransfers: [
        {
            id: 'usd-deposit',
            currency: 'USD',
            rails: ['ach_push', 'fednow', 'wire'],
            direction: 'deposit',
            flatFee: '0',
            payer: 'peanut',
        },
        {
            id: 'usd-ach-out',
            currency: 'USD',
            rails: ['ach', 'ach_same_day'],
            direction: 'withdraw',
            flatFee: '0',
            payer: 'peanut',
        },
        {
            id: 'usd-wire-out',
            currency: 'USD',
            rails: ['wire'],
            direction: 'withdraw',
            flatFee: '20.00',
            payer: 'provider',
            minAmount: '21.00',
        },
        {
            id: 'eur-sepa',
            currency: 'EUR',
            rails: ['sepa'],
            direction: 'both',
            flatFee: '0',
            payer: 'peanut',
        },
        {
            id: 'gbp-fps',
            currency: 'GBP',
            rails: ['faster_payments'],
            direction: 'both',
            flatFee: '0',
            payer: 'peanut',
        },
        {
            id: 'mxn-spei',
            currency: 'MXN',
            rails: ['spei'],
            direction: 'both',
            flatFee: '0',
            payer: 'peanut',
        },
        {
            id: 'cop-local',
            currency: 'COP',
            rails: ['bre_b'],
            direction: 'both',
            flatFee: '0',
            payer: 'peanut',
        },
        {
            id: 'ars-local',
            currency: 'ARS',
            rails: ['cbu_cvu', 'qr'],
            direction: 'both',
            flatFee: '0',
            payer: 'peanut',
        },
        {
            id: 'brl-pix-br',
            currency: 'BRL',
            rails: ['pix'],
            direction: 'both',
            flatFee: '0.75',
            payer: 'provider',
            residency: 'BR',
            minDeposit: '20',
            minPayout: '5',
        },
    ],
    card: {
        issuanceUsd: '0',
        monthlyUsd: '0',
        topUpUsd: '0',
        peanutPaymentFeePct: '0',
        thirdPartyNote: 'visa_network',
    },
    crypto: {
        depositsUsd: '0',
        peanutFeeUsd: '0',
        otherNetworksDeliveryFee: 'live_quote',
        networkFeeWithdrawals: [
            { chain: 'SOLANA', flatFeeUsd: '0.50', pctFee: '0.0007', minWithdrawalUsd: '1.00' },
            { chain: 'TRON', flatFeeUsd: '1.40', pctFee: '0.0007', minWithdrawalUsd: '10.10' },
            { chain: 'ETHEREUM', flatFeeUsd: '1.50', pctFee: '0.0007', minWithdrawalUsd: '5.05' },
        ],
    },
    generatedAt: '2026-11-27T00:00:00.000Z',
}

/** Find a non-zero flat fee for the converter card (returns null when $0 so no zero-fee row renders). */
export function getActiveFlatFeeForCurrency(
    schedule: FxFeeSchedule,
    currency: SupportedExchangeCurrency,
    direction: RatesDirection,
    userCountryCode?: string | null
): { amount: number; currency: string; payer: 'peanut' | 'provider'; railHint?: string } | null {
    const isBrResident = userCountryCode?.trim().toUpperCase() === 'BR'
    for (const row of schedule.bankTransfers) {
        if (row.currency !== currency) continue
        if (row.direction !== 'both' && row.direction !== direction) continue
        if (row.residency === 'BR' && !isBrResident) continue
        const amount = Number(row.flatFee)
        if (Number.isFinite(amount) && amount > 0) {
            return {
                amount,
                currency: row.currency,
                payer: row.payer,
                railHint: row.id === 'usd-wire-out' ? 'wire' : undefined,
            }
        }
    }
    return null
}
