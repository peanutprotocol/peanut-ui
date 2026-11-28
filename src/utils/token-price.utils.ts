import type { ITokenPriceData } from '@/interfaces/interfaces'

/**
 * Whether a token price is fit to size a payment, not just to display one.
 * The API serves a cached price for up to 24 h when its price provider fails
 * (TASK-23172) and flags it `stale`; converting money with it would send the
 * wrong token amount. Client-side age is not checked: the price query only
 * refreshes on focus or remount, so an age limit would dead-end a user who
 * waited on the screen, with no retry that fetches a new price.
 */
export function isPriceFreshForConversion(price: Pick<ITokenPriceData, 'stale'>): boolean {
    return !price.stale
}
