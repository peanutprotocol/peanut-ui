import Image from 'next/image'
import mantecaScanner from '@/assets/iphone-ss/manteca_ss.webp'
import { StarLpQrCode } from '@/components/Marketing/StarLp/StarLpQrCode'
import { QrBrazilAppLink } from './QrBrazilAppLink'
import { QrBrazilPixSticker } from './QrBrazilPixSticker'
import { QR_BRAZIL_SCANNER_CODE } from './qrBrazil.consts'

const pct = (fraction: number) => `${fraction * 100}%`

/**
 * The hero art: a "Pague com Pix" sticker beside the real Peanut scanner.
 * The phone stands upright and the hero's bottom edge cuts it
 * (artPlacement="edge"), so it rises out of the marquee below: its top
 * 520 px show at every width, cut in the dark band under the scan window,
 * above the capture's network labels. Those include Mercado Pago, which is
 * the Argentina rail (spending.md), so this page never shows them. No fade:
 * the cut is hard.
 * Its viewfinder shows the sticker's own code with a pink scan bar sweeping
 * it, so the two make one scan. The sticker rocks three times after load and
 * then rests (.qr-br-wobble, QrBrazilMotionStyle).
 * No scroll entrance: the art is above the fold and must paint with the page.
 * A tap on the sticker or the scanner opens what the CTA opens: a phone
 * cannot scan itself. The sticker sits low enough that the scanner's close
 * icon shows whole above it at every width, never half covered.
 */
export function QrBrazilHeroScene() {
    return (
        <div className="relative w-full">
            <div className="ml-auto w-[84%] md:mr-3 md:w-[74%]">
                <QrBrazilAppLink>
                    <div className="aspect-[451/520] overflow-hidden">
                        <div className="relative">
                            <Image
                                src={mantecaScanner}
                                alt="Peanut scanner reading a QR code"
                                sizes="(min-width: 1024px) 430px, 300px"
                                className="h-auto w-full"
                                priority
                            />
                            <div
                                className="absolute overflow-hidden rounded-card"
                                style={{
                                    left: pct(QR_BRAZIL_SCANNER_CODE.left),
                                    top: pct(QR_BRAZIL_SCANNER_CODE.top),
                                    width: pct(QR_BRAZIL_SCANNER_CODE.width),
                                    height: pct(QR_BRAZIL_SCANNER_CODE.height),
                                }}
                            >
                                <StarLpQrCode campaign="qr-brazil" slot="hero-sticker" className="size-full" />
                                <span aria-hidden className="qr-br-scanline" />
                            </div>
                        </div>
                    </div>
                </QrBrazilAppLink>
            </div>
            <div className="absolute top-[26%] left-0 z-10 w-[40%] -rotate-6 md:top-[25%]">
                <div className="qr-br-wobble">
                    <QrBrazilAppLink>
                        <QrBrazilPixSticker slot="hero-sticker" priority />
                    </QrBrazilAppLink>
                </div>
            </div>
        </div>
    )
}
