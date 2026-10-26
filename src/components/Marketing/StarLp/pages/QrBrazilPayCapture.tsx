import Image from 'next/image'
import payCapture from '@/assets/star-lp/qr-brazil-pay.webp'
import payCaptureNoRate from '@/assets/star-lp/qr-brazil-pay-norate.webp'
import { QR_BRAZIL_AMOUNT_BRL, QR_BRAZIL_PAY_CAPTURE } from './qrBrazil.consts'
import { QrBrazilPayButtonPress } from './QrBrazilPayButtonPress'
import { qrBrazilUsdFor } from './qrBrazil.utils'
import type { QrBrazilPayCaptureProps } from './qrBrazil.types'

const SIZES = '(min-width: 768px) 310px, 80vw'
const { width: W, height: H, converted, rate } = QR_BRAZIL_PAY_CAPTURE
const pct = (value: number, of: number) => `${(value / of) * 100}%`
// Container-query width units keep the live text at the app's size as the capture scales,
// but never below 12px: on a phone the capture shrinks to about half size, and
// the live rate is the one figure on it that must stay readable.
const cqw = (px: number, minPx: number) => `max(${minPx}px, ${(px / W) * 100}cqw)`

/**
 * The app's real Pix Pay screen (fixture qr-pay-pix-key-owner, R$ 18,00 to the
 * shop, QR_BRAZIL_SHOP_NAME, at its CNPJ key). The converted amount and the rate are
 * the live Manteca rate, written where the app prints them; without a live
 * rate the capture without those rows is used, so no figure is ever stale.
 * `pressed` plays one tap on the capture's own Pay button.
 */
export function QrBrazilPayCapture({ usdBrl, pressed }: QrBrazilPayCaptureProps) {
    if (!usdBrl) {
        return (
            <div className="relative">
                <Image src={payCaptureNoRate} alt="" sizes={SIZES} className="block w-full" />
                <QrBrazilPayButtonPress src={payCaptureNoRate.src} variant="norate" pressed={pressed} />
            </div>
        )
    }
    const text = 'absolute whitespace-nowrap font-sans font-bold text-foreground-primary'
    return (
        <div className="@container relative">
            <Image src={payCapture} alt="" sizes={SIZES} className="block w-full" />
            <span
                className={text}
                style={{
                    left: pct(converted.centerX, W),
                    top: pct(converted.top, H),
                    fontSize: cqw(converted.fontSize, 13),
                    lineHeight: cqw(converted.lineHeight, 16),
                    transform: 'translateX(-50%)',
                }}
            >
                ≈ USD {qrBrazilUsdFor(QR_BRAZIL_AMOUNT_BRL, usdBrl.rate)}
            </span>
            <span
                className={text}
                style={{
                    left: pct(rate.left, W),
                    top: pct(rate.top, H),
                    fontSize: cqw(rate.fontSize, 12),
                    lineHeight: cqw(rate.lineHeight, 16),
                }}
            >
                1 USD = {usdBrl.rate} BRL
            </span>
            <QrBrazilPayButtonPress src={payCapture.src} variant="live" pressed={pressed} />
        </div>
    )
}
