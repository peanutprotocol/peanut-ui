'use client'

import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { QrArgentinaRateFallback } from './QrArgentinaRateFallback'
import { QrArgentinaRateHeadline } from './QrArgentinaRateHeadline'
import { QrArgentinaReview } from './QrArgentinaReview'
import { qrArgentinaRateHeadline } from './qrArgentinaRate.utils'
import { useQrArgentinaRateCountUp } from './useQrArgentinaRateCountUp'
import type { QrArgentinaRateFoldProps } from './qrArgentina.types'

/**
 * The cream fold: today's rate as the headline beside the pay screen that
 * proves it. The headline and the pay screen's "Exchange rate" row print the
 * same live value; the headline counts up to it once on scroll-in, while the
 * row holds the live rate throughout.
 */
export function QrArgentinaRateFold({ usdArs }: QrArgentinaRateFoldProps) {
    const headline = qrArgentinaRateHeadline(usdArs)
    const { ref, shown } = useQrArgentinaRateCountUp(headline?.rate ?? null)
    return (
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
            {headline && shown !== null ? (
                <QrArgentinaRateHeadline headline={headline} shown={shown} numberRef={ref} />
            ) : (
                <QrArgentinaRateFallback />
            )}
            <PopIn tilt={-1}>
                <QrArgentinaReview usdArs={usdArs} />
            </PopIn>
        </div>
    )
}
