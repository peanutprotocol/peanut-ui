'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { MERCADO_PAGO } from '@/assets/payment-apps'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { marketingBase } from '@/i18n/app/messages.marketing'
import {
    QR_AR_MERCHANT,
    QR_AR_PAID_EVENT,
    QR_AR_PAYING_MS,
    QR_AR_PRICE_ARS,
    QR_AR_THEIR_SCREEN_ID,
} from './qrArgentina.consts'
import { formatUsdArsRate } from './qrArgentinaRate.utils'
import type { QrArgentinaReviewProps } from './qrArgentina.types'

const ARS = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const USD = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// The app's own row strings, in English like the rest of this page.
const ROWS = marketingBase.common

/**
 * The app's QR pay screen before you pay, built from its own parts (the
 * Mercado Pago method icon, the merchant Card, the dollar line, the
 * "Exchange rate" and "Peanut fee" rows and the Pay button) with the live
 * Manteca rate the payment executes at. Not a capture: a PNG would freeze the rate.
 * The rate row prints only a live rate, never a counted, rounded or old one:
 * without a live rate the row and the dollar line go, as on the Brazil pay
 * capture, so the frame never carries words the app does not print. The fee
 * row stays.
 *
 * Pay moves money nowhere: like the app, it shows its processing beat (the
 * Button's spinner), then plays the next beat, the shop's screen.
 */
export function QrArgentinaReview({ usdArs }: QrArgentinaReviewProps) {
    const price = `ARS ${ARS.format(QR_AR_PRICE_ARS)}`
    const live = usdArs.tier === 'live' ? usdArs.quote : null
    const usd = live ? `USD ${USD.format(QR_AR_PRICE_ARS / live.rate)}` : null
    const rate = live ? `1 USD = ${formatUsdArsRate(live.rate)} ARS` : null

    const [paying, setPaying] = useState(false)
    const timer = useRef<number | undefined>(undefined)
    useEffect(() => () => window.clearTimeout(timer.current), [])

    const pay = () => {
        if (paying) return
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const showShop = () => {
            setPaying(false)
            const target = document.getElementById(QR_AR_THEIR_SCREEN_ID)
            target?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
            window.dispatchEvent(new Event(QR_AR_PAID_EVENT))
        }
        if (reduce) return showShop()
        setPaying(true)
        timer.current = window.setTimeout(showShop, QR_AR_PAYING_MS)
    }

    return (
        // md+ scales the whole phone (zoom keeps its proportions) so it balances the headline
        <div className="star-lp-phone mx-auto w-full max-w-[18.5rem] border-4 border-border-default bg-background-default p-2 shadow-4 md:[zoom:1.1] lg:[zoom:1.4]">
            <div className="star-lp-phone-screen flex flex-col gap-3 bg-background-page px-3 pt-3 pb-4 text-left text-foreground-primary">
                <p className="sr-only">
                    {`The Peanut pay screen: paying ${QR_AR_MERCHANT} ${price}${
                        usd && rate ? `, about ${usd}, at ${rate}` : ''
                    }. ${ROWS.peanutFee}: ${ROWS.sponsoredByPeanut}`}
                </p>
                <div aria-hidden className="flex flex-col gap-3">
                    <p className="text-center text-heading-xs">Pay</p>
                    <Card className="p-3">
                        <div className="flex items-center gap-3">
                            <Image src={MERCADO_PAGO} alt="" width={40} height={40} className="size-10 rounded-full" />
                            <span className="min-w-0">
                                <span className="flex items-center gap-1 text-body-xs">
                                    <Icon name="arrow-up-right" size={16} />
                                    Paying
                                </span>
                                <span className="block text-label-l">{QR_AR_MERCHANT}</span>
                            </span>
                        </div>
                    </Card>
                    <Card className="items-center gap-1 p-4">
                        <span className="flex items-baseline gap-1">
                            <span className="text-body-m-semibold">ARS</span>
                            <span className="font-roboto-flex-extrabold text-heading-m">
                                {ARS.format(QR_AR_PRICE_ARS)}
                            </span>
                        </span>
                        {usd && <span className="text-body-m-semibold">≈ {usd}</span>}
                    </Card>
                    <Card className="px-3 py-0">
                        {rate && (
                            <span
                                data-testid="qr-ar-rate-row"
                                className="flex flex-col gap-1 border-b border-dashed border-border-default py-2"
                            >
                                <span className="text-label-m">{ROWS.exchangeRate}</span>
                                <span className="text-body-m-semibold tabular-nums">{rate}</span>
                            </span>
                        )}
                        <span className="flex flex-col gap-1 py-2">
                            <span className="text-label-m">{ROWS.peanutFee}</span>
                            <span className="text-body-m-semibold">{ROWS.sponsoredByPeanut}</span>
                        </span>
                    </Card>
                </div>
                <Button
                    variant="primary"
                    shadowSize="4"
                    onClick={pay}
                    loading={paying}
                    aria-disabled={paying}
                    aria-label="Pay, then see the shop's screen"
                >
                    Pay
                </Button>
            </div>
        </div>
    )
}
