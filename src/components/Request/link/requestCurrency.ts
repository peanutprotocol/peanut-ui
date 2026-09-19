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
