import { ceilToMinorUnit, minorUnitDigits } from '@/features/deposit-accounts/payerAmount'

/**
 * The dollar side of a request asked in another currency, as a plain decimal
 * string, or '' when there is nothing to convert or no rate yet.
 *
 * An estimate for the requester's eyes and for the pay link made before the
 * request exists. The API computes the stored dollar amount at its own rate.
 *
 * @param unitsPerUsd how many units of the request currency one dollar buys
 */
export function usdEquivalent(amount: string, unitsPerUsd: number): string {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || !(unitsPerUsd > 0)) return ''
    return (value / unitsPerUsd).toFixed(2)
}

/**
 * The amount as the API takes it: `^\d+(\.\d+)?$`. A requester can leave the
 * field at ".5" or "100.", which the API refuses as not a valid amount.
 */
export function toApiAmount(amount: string): string {
    const trimmed = amount.trim().replace(/\.$/, '')
    return trimmed.startsWith('.') ? `0${trimmed}` : trimmed
}

/** What the amount field reports: both sides, and the one on screen. */
export interface AmountInputSides {
    /** the amount in the request currency */
    primary: string
    /** the dollar side; '' while there is no rate */
    secondary: string
    /** whichever side the requester is typing in */
    displayed: string
}

/**
 * The amount the request asks for, in its own currency.
 *
 * A requester can swap the field and type dollars. The field then converts to
 * the request currency and cuts the result off at the minor unit, so $50 became
 * 42.49 EUR, which is $49.99: the requester asked for less than they typed. The
 * API rounds its own conversion UP to the minor unit, in the requester's favour,
 * and this does the same.
 *
 * @param unitsPerUsd how many units of the request currency one dollar buys
 */
export function requestAmountFromInput(sides: AmountInputSides, currency: string, unitsPerUsd: number): string {
    const typedUsd =
        currency !== 'USD' &&
        unitsPerUsd > 0 &&
        sides.displayed !== '' &&
        sides.displayed === sides.secondary &&
        sides.displayed !== sides.primary
    if (!typedUsd) return sides.primary
    const usd = Number(sides.displayed)
    if (!Number.isFinite(usd) || usd <= 0) return sides.primary
    return ceilToMinorUnit(usd * unitsPerUsd, currency).toFixed(minorUnitDigits(currency))
}
