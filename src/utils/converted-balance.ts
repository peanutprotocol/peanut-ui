import { parseUnits } from 'viem'

/** Indicative valuation only. Truncate fractional token units; never increase spendability. */
export function convertedAccountTotal(selected: bigint, other: bigint, rate: string): bigint | undefined {
    if (selected < 0n || other < 0n || !/^\d{1,12}(?:\.\d{1,18})?$/.test(rate)) return undefined
    const scaledRate = parseUnits(rate, 18)
    if (scaledRate <= 0n) return undefined
    return selected + (other * scaledRate) / 10n ** 18n
}

export function sendAmountUnits(amount: string): bigint | undefined {
    if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(amount)) return undefined
    const units = parseUnits(amount, 6)
    return units > 0n ? units : undefined
}

export function displayAccountUnits(units: bigint) {
    const cents = units / 10_000n
    return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`
}
