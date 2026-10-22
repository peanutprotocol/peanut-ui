'use client'

import { PopIn } from '@/components/Marketing/StarLp/PopIn'
import { SectionTitle } from '@/components/Marketing/StarLp/SectionTitle'
import { QrArgentinaRateFallback } from './QrArgentinaRateFallback'
import { QrArgentinaRateHeadline } from './QrArgentinaRateHeadline'
import { QrArgentinaReview } from './QrArgentinaReview'
import { QR_AR_SAVING_FOOTNOTE, QR_AR_SAVING_HEADLINE } from './qrArgentinaRate.consts'
import { formatUsdArsRate, qrArgentinaRateHeadline } from './qrArgentinaRate.utils'
import { useQrArgentinaRateCountUp } from './useQrArgentinaRateCountUp'
import type { QrArgentinaRateFoldProps } from './qrArgentina.types'

/**
 * The cream fold: the saving against a foreign card as the headline (the
 * dated example pricing.md allows, its footnote right under: see
 * qrArgentinaRate.consts), the live rate as the big support line, and the pay
 * screen that proves the rate. The rate's tier comes from the server (the
 * backend's timestamps, never the visitor's clock). Live: the exact rate,
 * counted up once on scroll-in, and the pay screen's "Exchange rate" row prints
 * the same value. Last-known: "≈" and the rate rounded, at rest, and the row
 * prints no rate. None: "Best rate". The saving never moves with the rate.
 */
export function QrArgentinaRateFold({ usdArs }: QrArgentinaRateFoldProps) {
    const headline = qrArgentinaRateHeadline(usdArs)
    const { ref, shown } = useQrArgentinaRateCountUp(headline?.countsUp ? headline.rate : null)
    const [saving, against] = QR_AR_SAVING_HEADLINE
    return (
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div className="flex flex-col gap-6">
                <SectionTitle>
                    {/* green-800: the ramp's green that reads on cream (green-500 does not at any size) */}
                    <span className="block text-green-800">{saving}</span> <span className="block">{against}</span>
                </SectionTitle>
                {headline ? (
                    <QrArgentinaRateHeadline
                        headline={headline}
                        shown={shown === null ? headline.value : formatUsdArsRate(shown)}
                        numberRef={ref}
                    />
                ) : (
                    <QrArgentinaRateFallback />
                )}
                <p className="text-body-s text-foreground-secondary">{QR_AR_SAVING_FOOTNOTE}</p>
            </div>
            <PopIn tilt={-1}>
                <QrArgentinaReview usdArs={usdArs} />
            </PopIn>
        </div>
    )
}
