import { countryData as ALL_METHODS_DATA, type CountryData } from '@/components/AddMoney/consts'
import { BRIDGE_DEVELOPER_FEE_RATE } from '@/constants/payment.consts'
import { type Account, AccountType } from '@/interfaces'

export interface CurrencyConfig {
    currency: string
    paymentRail: string
}

export type BridgeOperationType = 'onramp' | 'offramp'

/**
 * Map a country selection to the rail-jurisdiction code its bank rail uses
 * in the capability model. Bridge SEPA rails are stored with country='EU'
 * (one rail spans all 27 EU member states); ACH/SPEI/Faster Payments use
 * their own ISO2. Manteca rails are stored under the user's country
 * (BR/AR). Used by deposit/withdraw bank pages to country-scope the
 * capability gate so a stuck PENDING rail in country X doesn't block
 * country Y's flow (e.g. a ghost BANK_TRANSFER_AR rail shouldn't keep the
 * Portugal-SEPA page in a "Setting up your account…" wait loop).
 *
 * Contract:
 * - missing input (null/undefined/empty) → undefined; the gate falls back
 *   to a channel-only scope.
 * - recognized US/MX/GB/AR/BR → the matching ISO2 code.
 * - anything else → 'EU'. This intentionally mirrors `getCurrencyConfig`'s
 *   "everything else → SEPA/EUR" default. Returning undefined here would
 *   re-introduce the original bug (unscoped gate sees stuck pending rails
 *   from unrelated jurisdictions); Bridge serves every other country we
 *   support via SEPA, so 'EU' is the right scope for any unmapped entry.
 */
export const railJurisdictionForBank = (countryId: string | null | undefined): string | undefined => {
    if (!countryId) return undefined
    const upper = countryId.toUpperCase()
    if (upper === 'US' || upper === 'USA') return 'US'
    if (upper === 'MX' || upper === 'MEX') return 'MX'
    if (upper === 'GB' || upper === 'GBR') return 'GB'
    if (upper === 'AR' || upper === 'ARG') return 'AR'
    if (upper === 'BR' || upper === 'BRA') return 'BR'
    return 'EU'
}

/**
 * Get currency configuration for a specific country and operation type
 * USA -> USD/ACH, Mexico -> MXN/SPEI, everything else -> EUR/SEPA
 * Payment rails differ between onramp and offramp operations
 */
export const getCurrencyConfig = (countryId: string, operationType: BridgeOperationType): CurrencyConfig => {
    if (countryId === 'US' || countryId === 'USA') {
        return {
            currency: 'usd',
            paymentRail: operationType === 'onramp' ? 'ach_push' : 'ach',
        }
    }

    if (countryId === 'MX') {
        return {
            currency: 'mxn',
            paymentRail: 'spei', // SPEI works for both onramp and offramp in Mexico
        }
    }

    if (countryId === 'GB' || countryId === 'GBR') {
        return {
            currency: 'gbp',
            paymentRail: 'faster_payments', // UK Faster Payments
        }
    }

    // All other countries use EUR/SEPA
    return {
        currency: 'eur',
        paymentRail: 'sepa', // SEPA works for both onramp and offramp in Europe
    }
}

/**
 * Get currency configuration specifically for offramp operations
 */
export const getOfframpCurrencyConfig = (countryId: string): CurrencyConfig => {
    return getCurrencyConfig(countryId, 'offramp')
}

/**
 * Derive the offramp destination currency + payment rail from the bank
 * account's actual `type`, falling back to country only when the type is
 * unknown.
 *
 * Why: `getOfframpCurrencyConfig(country)` defaults *any* unknown country to
 * EUR+SEPA. Pairing that default with a GBP/UK account caused Bridge to 400
 * with "country is not supported for SEPA" (PEANUT-API-5P/5M/5N, 2026-06-02
 * 21:24 UTC) — Bridge can't SEPA-credit a GBP account. The bank account's
 * `type` already carries the right answer for every Bridge destination we
 * support (`us`/`gb`/`clabe`/`iban`), so derive from it directly.
 *
 * Manteca-type accounts use a non-Bridge rail; the caller must NOT route
 * those through this helper. We throw rather than silently misclassify.
 */
export const getOfframpConfigFromAccount = (account: {
    type?: string | AccountType | null
    country?: string | null
}): CurrencyConfig => {
    const t = account.type?.toString().toLowerCase()
    if (t === AccountType.US || t?.endsWith('ach') || t?.endsWith('us')) return getCurrencyConfig('US', 'offramp')
    if (t === AccountType.GB || t?.endsWith('gb')) return getCurrencyConfig('GB', 'offramp')
    if (t === AccountType.CLABE || t?.endsWith('clabe')) return getCurrencyConfig('MX', 'offramp')
    if (t === AccountType.IBAN || t?.endsWith('iban')) return getCurrencyConfig('EU', 'offramp')
    if (t === AccountType.MANTECA || t?.endsWith('manteca')) {
        throw new Error('Manteca accounts route through a separate offramp path, not Bridge.')
    }
    // type missing / unknown — fall back to country, preserving prior behavior.
    return getOfframpCurrencyConfig(account.country ?? 'EU')
}

/**
 * Map ISO fiat currency → Bridge bank AccountType. Used by onramp quote
 * + exchange-rate callers that only have the currency string in hand.
 */
export const currencyToAccountType = (currency: string): AccountType => {
    const normalized = currency.toLowerCase()
    if (normalized === 'usd') return AccountType.US
    if (normalized === 'mxn') return AccountType.CLABE
    if (normalized === 'gbp') return AccountType.GB
    return AccountType.IBAN
}

/**
 * Get the fiat currency symbol for display purposes
 */
export const getCurrencySymbol = (currency: string): string => {
    const symbols: Record<string, string> = {
        usd: '$',
        eur: '€',
        mxn: 'MX$',
        gbp: '£',
    }
    return symbols[currency.toLowerCase()] || currency.toUpperCase()
}

/**
 * Apply the Bridge developer fee to a cross-currency quote.
 *
 * Bridge charges a 0.5% developer fee on any transfer that crosses a
 * currency boundary (i.e. neither side is USD). USD↔USDC is fee-free.
 * Mirrors backend `getBridgeDeveloperFeeParams` in peanut-api-ts.
 *
 * @param amount - Gross amount computed from the raw exchange rate
 * @param srcCurrency - Source currency code (case-insensitive)
 * @param dstCurrency - Destination currency code (case-insensitive)
 * @returns Net amount after fee deduction, or unchanged amount if either side is USD
 */
export const applyBridgeCrossCurrencyFee = (amount: number, srcCurrency: string, dstCurrency: string): number => {
    const src = (srcCurrency ?? '').toLowerCase()
    const dst = (dstCurrency ?? '').toLowerCase()
    if (src === 'usd' || dst === 'usd') {
        return amount
    }
    return amount * (1 - BRIDGE_DEVELOPER_FEE_RATE)
}

/**
 * Inverse of {@link applyBridgeCrossCurrencyFee}.
 *
 * Given a net (post-fee) destination amount, return the gross amount that
 * would produce it. Used when the user types a "Recipient Gets" value and
 * we need the pre-fee gross to feed back into rate math. USD pairs pass
 * through unchanged (no fee, so gross === net).
 *
 * Math note: since `apply(gross) = gross * (1 - rate)`, the reverse is
 * `gross = net / (1 - rate)` — NOT `net * (1 + rate)`, which would
 * under-shoot by `rate²` (e.g. reversing 99.5 must yield exactly 100).
 *
 * @param netAmount - Net amount after Bridge dev fee
 * @param srcCurrency - Source currency code (case-insensitive)
 * @param dstCurrency - Destination currency code (case-insensitive)
 * @returns Gross amount before fee, or unchanged amount if either side is USD
 */
export const reverseBridgeCrossCurrencyFee = (netAmount: number, srcCurrency: string, dstCurrency: string): number => {
    const src = (srcCurrency ?? '').toLowerCase()
    const dst = (dstCurrency ?? '').toLowerCase()
    if (src === 'usd' || dst === 'usd') {
        return netAmount
    }
    return netAmount / (1 - BRIDGE_DEVELOPER_FEE_RATE)
}

/**
 * Get minimum amount for onramp operations by country
 */
export const getMinimumAmount = (countryId: string): number => {
    if (countryId === 'MX') {
        return 50
    }

    // UK has a minimum of 3 GBP
    if (countryId === 'GB' || countryId === 'GBR') {
        return 3
    }

    // Default minimum for all other countries (including US and EU)
    return 1
}

/**
 * Get human-readable payment rail name
 */
export const getPaymentRailDisplayName = (paymentRail: string): string => {
    const displayNames: Record<string, string> = {
        ach_push: 'ACH Transfer',
        ach: 'ACH Transfer',
        sepa: 'SEPA Transfer',
        spei: 'SPEI Transfer',
        wire: 'Wire Transfer',
        faster_payments: 'Faster Payments',
    }
    return displayNames[paymentRail] || paymentRail.toUpperCase()
}

export function getCountryFromPath(countryPath: string): CountryData | undefined {
    return ALL_METHODS_DATA.find((c) => c.path.toLowerCase() === countryPath.toLowerCase())
}

export function getCountryFromAccount(account: Account): CountryData | undefined {
    const code = (account.details?.countryCode ?? '').toUpperCase()

    if (account.type === AccountType.US) {
        return ALL_METHODS_DATA.find((c) => c.id === 'US')
    }
    // Try countryName first; fall back to the country code. Bridge stores
    // ISO3 ('USA', 'GBR'); CountryData carries both `iso3` and `iso2` (= `id`),
    // so accept either shape so a name mismatch doesn't drop the lookup.
    const byName = account.details?.countryName
        ? ALL_METHODS_DATA.find((c) => c.path.toLowerCase() === account.details?.countryName?.toLowerCase())
        : undefined
    return byName ?? ALL_METHODS_DATA.find((c) => c.iso3 === code || c.id === code)
}

/**
 * Infer bank account type from account identifier format
 * Used for displaying bank account types in analytics/admin tools
 */
export const inferBankAccountType = (accountId: string): string => {
    if (!accountId) return 'Bank Account'

    // Reference IDs (not real account numbers)
    if (accountId.startsWith('manteca_') || accountId.startsWith('bank_')) {
        return 'Bank Account'
    }

    // IBAN: starts with 2 letters + 2 digits (e.g., ES12, DE89, FR76)
    if (/^[A-Z]{2}\d{2}[A-Z0-9]+$/i.test(accountId)) {
        return 'SEPA (IBAN)'
    }

    // CBU/CVU (Argentina): exactly 22 digits
    // CBU = Clave Bancaria Uniforme (traditional)
    // CVU = Clave Virtual Uniforme (virtual wallets like MercadoPago)
    if (/^\d{22}$/.test(accountId)) {
        return 'CBU/CVU'
    }

    // CLABE (Mexico): 18 digits (allow 16-20 for padding variance)
    // CLABEs typically start with 3-digit bank code (e.g., 646, 012, 002)
    if (/^\d{18}$/.test(accountId)) {
        return 'SPEI (CLABE)'
    }

    // PIX (Brazil): Can be CPF (11 digits), CNPJ (14 digits), or UUID
    // Check for UUID format first (most distinctive)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)) {
        return 'PIX (Random Key)'
    }
    // CPF format: 11 digits
    if (/^\d{11}$/.test(accountId)) {
        return 'PIX (CPF)'
    }
    // CNPJ format: 14 digits
    if (/^\d{14}$/.test(accountId)) {
        return 'PIX (CNPJ)'
    }
    // PIX can also be email or phone - check if it contains @ or +
    if (accountId.includes('@')) {
        return 'PIX (Email)'
    }
    if (accountId.startsWith('+') || /^\d{10,15}$/.test(accountId)) {
        // Phone numbers: +5511999999999 or just 11999999999
        return 'PIX (Phone)'
    }

    // CLABE with padding: 16-20 digits (but not 18 which is standard, not 22 which is CBU)
    if (/^\d{16,17}$/.test(accountId) || /^\d{19,20}$/.test(accountId)) {
        return 'SPEI (CLABE)'
    }

    // ACH (US): typically 9-15 digits (routing + account)
    if (/^\d{9,10}$/.test(accountId) || /^\d{12,13}$/.test(accountId) || /^\d{15}$/.test(accountId)) {
        return 'ACH'
    }

    // UK Faster Payments: 8-digit account number (sort code stored separately)
    if (/^\d{8}$/.test(accountId)) {
        return 'Faster Payments (UK)'
    }

    // Fallback for other numeric formats
    if (/^\d+$/.test(accountId)) {
        return 'Bank Account'
    }

    return 'Bank Account'
}
