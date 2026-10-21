import type { StarLpFxRate } from '@/components/Marketing/StarLp/starLp.types'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/**
 * The money-in push body for a euro deposit, in the app's words
 * (peanut-api-ts deposit.copy.ts fiatCompleted: "<money> added from <account
 * or your bank>."). A deposit account credits dollars (USDC, shown as "$"),
 * and the completion event carries no payer account, so the app falls back
 * to "your bank". The dollar figure is the euros at the live rate, floored to
 * the cent; without a live rate there is no figure, so no body.
 */
export function usEuMoneyInBody(eur: number, eurUsd: StarLpFxRate | null): string | null {
    if (!eurUsd || !(eurUsd.rate > 0)) return null
    return `${usd.format(Math.floor(eur * eurUsd.rate * 100) / 100)} added from your bank.`
}
