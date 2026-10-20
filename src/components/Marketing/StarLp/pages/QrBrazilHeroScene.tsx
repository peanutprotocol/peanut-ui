import Image from 'next/image'
import mantecaScanner from '@/assets/iphone-ss/manteca_ss.webp'
import { StarLpQrCode } from '@/components/Marketing/StarLp/StarLpQrCode'
import { QrBrazilAppLink } from './QrBrazilAppLink'
import { QrBrazilPixSticker } from './QrBrazilPixSticker'
import { QR_BRAZIL_SCANNER_CODE } from './qrBrazil.consts'

const pct = (fraction: number) => `${fraction * 100}%`

/**
 * The hero art: a "Pague com Pix" sticker beside the real Peanut scanner.
 * The capture is cropped above its network labels and fades out at the foot;
 * its viewfinder shows the sticker's own code with a pink scan bar sweeping
 * it, so the two make one scan. The sticker rocks three times after load and
 * then rests (.qr-br-wobble, QrBrazilMotionStyle).
 * No scroll entrance: the art is above the fold and must paint with the page.
 * A tap on the sticker or the scanner opens what the CTA opens: a phone
 * cannot scan itself.
 */
export function QrBrazilHeroScene() {
    return (
        <div className="relative mx-auto aspect-[10/7] w-full max-w-md">
            <div className="absolute top-0 right-[2%] w-[58%] rotate-3">
                <QrBrazilAppLink>
                    <div
                        className="relative aspect-[451/520] overflow-hidden"
                        style={{
                            maskImage: 'linear-gradient(to bottom, black 78%, transparent)',
                            WebkitMaskImage: 'linear-gradient(to bottom, black 78%, transparent)',
                        }}
                    >
                        <Image
                            src={mantecaScanner}
                            alt="Peanut scanner reading a QR code"
                            sizes="(min-width: 768px) 260px, 58vw"
                            className="w-full"
                            priority
                        />
                        <div
                            className="absolute overflow-hidden rounded-[6%]"
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
                </QrBrazilAppLink>
            </div>
            <div className="absolute top-[16%] left-[4%] z-10 w-[36%] -rotate-6">
                <div className="qr-br-wobble">
                    <QrBrazilAppLink>
                        <QrBrazilPixSticker slot="hero-sticker" priority />
                    </QrBrazilAppLink>
                </div>
            </div>
        </div>
    )
}
