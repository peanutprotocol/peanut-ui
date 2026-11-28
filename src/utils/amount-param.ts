import { createParser } from 'nuqs'

/** Raw decimal text an amount field accepts: digits and one dot, finite. Anything else reads as ''. */
export const finiteAmountText = (value: string = '') =>
    value.length <= 1024 && /^\d*\.?\d*$/.test(value) && Number.isFinite(Number(value || '0')) ? value : ''

/**
 * `?amount=` as the amount field would hold it, or null: `5e3` or `abc` from a hand-edited or shared
 * URL must not reach parseFloat or parseUnits as a different amount.
 */
export const parseAsAmount = createParser({
    parse: (value: string) => finiteAmountText(value) || null,
    serialize: (value: string) => value,
})
