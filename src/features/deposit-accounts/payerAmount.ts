/**
 * What the payer has to send, in the currency their bank works in.
 *
 * The Peanut side of a request is in dollars and the account credits it in its
 * own currency, so a payer reading a dollar figure beside a euro IBAN has to do
 * the conversion themselves — and a payer who rounds down underpays. The
 * rounding here is always UP, to the smallest unit the currency has, so what
 * lands is never short of what was asked.
 */

import { STABLE_COINS } from '@/constants/general.consts'

/**
 * Whether a request's asked amount is a US-dollar figure the payer conversion
 * can trust.
 *
 * A Peanut wallet request carries no token symbol and settles in USDC, so it is
 * dollars; a request denominated in a non-USD token is not, and its amount must
 * not be shown to a bank payer as though it were.
 */
export function isUsdPeggedRequest(tokenSymbol: string | null | undefined): boolean {
    if (!tokenSymbol) return true
    return STABLE_COINS.includes(tokenSymbol.toUpperCase())
}

/** how many decimals the currency is paid in; two where we cannot tell */
export function minorUnitDigits(currency: string): number {
    try {
        return (
            new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
        )
    } catch {
        return 2
    }
}

/** `value` rounded UP to the smallest unit `currency` has. Never down: a short payment leaves the request open. */
export function ceilToMinorUnit(value: number, currency: string): number {
    const factor = 10 ** minorUnitDigits(currency)
    // Binary floating point puts an exact 8.29 just above 829 minor units, and
    // a bare ceil would then charge the payer a cent they do not owe. Nine
    // decimals is far below any real rate's precision and far above the error.
    return Math.ceil(Number((value * factor).toFixed(9))) / factor
}

/** The per-rail amount the API states, after parsing. */
export interface ServerPayerAmount {
    /** null when the API could not produce a figure: an open amount, or no rate */
    value: number | null
    currency: string
    isEstimate: boolean
    /** account-currency units per one US dollar, when the API converted from dollars */
    usdRate?: number
}

/**
 * Parse the API's `payerAmount`. Returns undefined for an API that does not
 * send the field yet, and for any shape this reader does not recognise. The
 * screen then converts on the client, as it did before the field existed.
 */
export function readServerPayerAmount(raw: unknown): ServerPayerAmount | undefined {
    if (!raw || typeof raw !== 'object') return undefined
    const { amount, currency, isEstimate, rate } = raw as Record<string, unknown>
    if (typeof currency !== 'string' || currency.length === 0) return undefined

    let value: number | null = null
    if (amount !== null && amount !== undefined) {
        value = Number(amount)
        if (!Number.isFinite(value) || value <= 0) return undefined
    }

    // Exact only when the API says so in as many words.
    const parsed: ServerPayerAmount = { value, currency: currency.toUpperCase(), isEstimate: isEstimate !== false }
    if (rate && typeof rate === 'object') {
        const { from, rate: quoted } = rate as Record<string, unknown>
        const usdRate = Number(quoted)
        if (typeof from === 'string' && from.toUpperCase() === 'USD' && usdRate > 0) parsed.usdRate = usdRate
    }
    return parsed
}

/** What the bank-transfer screen tells the payer to send. */
export type BankPayAmount =
    /**
     * A figure in the account's currency. An `estimate` is a converted figure
     * and is never copyable. `settlesRequest` is false for a part contribution
     * and for an open-amount request, where the screen must not promise "paid".
     */
    | { kind: 'local'; value: number; currency: string; estimate: boolean; settlesRequest: boolean }
    /** the API had no figure in the account's currency, so the screen states dollars and says the bank converts */
    | { kind: 'usd-only'; usd: number; accountCurrency: string }

/** Two dollar amounts are the same payment when they agree to the cent. */
const sameUsd = (a: number, b: number) => Math.abs(a - b) < 0.005

/**
 * The amount one payer sends by bank transfer, or undefined when there is
 * nothing honest to show — no amount asked or typed, or no rate yet.
 *
 * The API states the amount that settles the REST of the request. A payer who
 * contributes a part of a request pays their own amount, never the API figure:
 * showing a payer who gives $20 the $100 the request asks for makes them
 * overpay. The API figure is used only when the payer entered no amount, or
 * entered exactly what the request still needs.
 */
export function resolveBankPayAmount(params: {
    server: ServerPayerAmount | undefined
    /** what the payer typed, in dollars */
    payerUsd: string | undefined
    /** what the request still needs, in dollars; undefined on an open-amount request */
    remainingUsd: number | undefined
    accountCurrency: string
    /** account-currency units per dollar from the client rate feed; read only when the API sent no amount object */
    clientRate: number
    /**
     * False when the API's remainder is known to miss money the screen has
     * counted (a wallet or crypto contribution). Its figure would then ask the
     * payer for the full sum as a copyable "exact" amount. The rate it quoted
     * is still good, so the screen's own remainder is converted with it and
     * shown as an estimate.
     */
    serverCountsAllPayments?: boolean
}): BankPayAmount | undefined {
    const accountCurrency = params.accountCurrency.toUpperCase()
    // An API figure in another currency than the account is not a figure for
    // this account. Ignore it and convert here.
    const quoted = params.server?.currency === accountCurrency ? params.server : undefined
    const server = quoted && params.serverCountsAllPayments === false ? { ...quoted, value: null } : quoted

    const typed = Number(params.payerUsd)
    const payerUsd = Number.isFinite(typed) && typed > 0 ? typed : undefined
    const remainingUsd = params.remainingUsd !== undefined && params.remainingUsd > 0 ? params.remainingUsd : undefined

    const paysTheRest = payerUsd === undefined || (remainingUsd !== undefined && sameUsd(payerUsd, remainingUsd))
    const settlesRequest = remainingUsd !== undefined && paysTheRest

    // Dollars into a dollar account: what the payer typed is what they send.
    // With nothing typed, the API's own remainder beats the screen's.
    if (accountCurrency === 'USD') {
        const value = payerUsd ?? server?.value ?? remainingUsd
        if (value === undefined) return undefined
        return { kind: 'local', value: ceilToMinorUnit(value, 'USD'), currency: 'USD', estimate: false, settlesRequest }
    }

    if (server && server.value !== null && paysTheRest) {
        return {
            kind: 'local',
            value: ceilToMinorUnit(server.value, accountCurrency),
            currency: accountCurrency,
            estimate: server.isEstimate,
            settlesRequest,
        }
    }

    const usd = payerUsd ?? remainingUsd
    if (usd === undefined) return undefined

    // The payer's own amount, converted. Use the rate the API used; failing
    // that, the payer's share of the API figure.
    if (server) {
        const local =
            server.usdRate !== undefined
                ? usd * server.usdRate
                : server.value !== null && remainingUsd !== undefined
                  ? server.value * (usd / remainingUsd)
                  : undefined
        if (local === undefined) return { kind: 'usd-only', usd, accountCurrency }
        return {
            kind: 'local',
            value: ceilToMinorUnit(local, accountCurrency),
            currency: accountCurrency,
            estimate: true,
            settlesRequest,
        }
    }

    // An API that predates `payerAmount`. A wrong number is worse than no
    // number, so nothing shows until the client rate arrives.
    if (!(params.clientRate > 0)) return undefined
    return {
        kind: 'local',
        value: ceilToMinorUnit(usd * params.clientRate, accountCurrency),
        currency: accountCurrency,
        estimate: true,
        settlesRequest,
    }
}

/** The figure a screen prints for a bank pay amount. `approx` takes the "≈" prefix and is never copyable. */
export function bankPayAmountFigure(amount: BankPayAmount): {
    value: number
    currency: string
    digits: number
    approx: boolean
} {
    if (amount.kind === 'usd-only') return { value: amount.usd, currency: 'USD', digits: 2, approx: false }
    return {
        value: amount.value,
        currency: amount.currency,
        digits: minorUnitDigits(amount.currency),
        approx: amount.estimate,
    }
}
