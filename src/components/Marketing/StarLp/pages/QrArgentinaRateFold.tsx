'use client'

import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { QrArgentinaRateFallback } from './QrArgentinaRateFallback'
import { QrArgentinaRateHeadline } from './QrArgentinaRateHeadline'
import { QrArgentinaReview } from './QrArgentinaReview'
import { formatUsdArsRate, qrArgentinaRateHeadline } from './qrArgentinaRate.utils'
import { useQrArgentinaRateCountUp } from './useQrArgentinaRateCountUp'
import type { QrArgentinaRateFoldProps } from './qrArgentina.types'

/**
 * The cream fold: the rate as the headline beside the pay screen that proves
 * it. The tier comes from the server (the backend's timestamps, never the
 * visitor's clock). Live: the exact rate, counted up once on scroll-in, and the
 * pay screen's "Exchange rate" row prints the same value. Last-known: "≈" and
 * the rate rounded, at rest, and the row prints no rate. None: "Best rate".
 */
export function QrArgentinaRateFold({ usdArs }: QrArgentinaRateFoldProps) {
    const headline = qrArgentinaRateHeadline(usdArs)
    const { ref, shown } = useQrArgentinaRateCountUp(headline?.countsUp ? headline.rate : null)
    return (
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
            {headline ? (
                <QrArgentinaRateHeadline
                    headline={headline}
                    shown={shown === null ? headline.value : formatUsdArsRate(shown)}
                    numberRef={ref}
                />
            ) : (
                <QrArgentinaRateFallback />
            )}
            <PopIn tilt={-1}>
                <QrArgentinaReview usdArs={usdArs} />
            </PopIn>
        </div>
    )
}
