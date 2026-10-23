import type { StarLpFxReading } from '@/components/Marketing/StarLp/starLp.types'
import { QR_AR_DINERS, QR_AR_PRICE_ARS } from './qrArgentina.consts'
import { roundUsdArsRate } from './qrArgentinaRate.utils'

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const WHOLE_USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/**
 * The group chat's request: one diner's share of the parrilla bill in dollars,
 * on the same footing as the rate fold. Live: the exact share at the live
 * rate, rounded up to the cent. Last-known: the share at the rounded rate the
 * fold prints after "≈", rounded up to a whole dollar, as a friend would ask
 * for it. No rate: no figure (null), as the fold prints none.
 */
export function qrArDinnerShareUsd(usdArs: StarLpFxReading): string | null {
    const perHeadArs = QR_AR_PRICE_ARS / QR_AR_DINERS
    if (usdArs.tier === 'none') return null
    if (usdArs.tier === 'lastKnown') return WHOLE_USD.format(Math.ceil(perHeadArs / roundUsdArsRate(usdArs.quote.rate)))
    return USD.format(Math.ceil((perHeadArs / usdArs.quote.rate) * 100) / 100)
}
