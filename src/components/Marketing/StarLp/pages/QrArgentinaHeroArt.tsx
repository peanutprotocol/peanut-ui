import Image from 'next/image'
import mantecaScanner from '@/assets/iphone-ss/manteca_ss.webp'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { StarLpQrCode } from '@/components/Marketing/StarLp/StarLpQrCode'
import { QrArgentinaAppLink } from './QrArgentinaAppLink'
import { QrArgentinaScanLine } from './QrArgentinaScanLine'
import { QrArgentinaSticker } from './QrArgentinaSticker'

/**
 * The till's QR sticker next to the real Peanut scanner. The phone stands
 * upright and the hero's bottom edge cuts it (artPlacement="edge"), so it
 * rises out of the marquee below: its top 520 px show at every width, cut in
 * the dark band under the scan window, above the capture's network row (its
 * "ETH & EVMs" label is crypto vocabulary, which marketing copy never shows:
 * messaging.md guardrail 1). No fade: the cut is hard.
 *
 * The capture's own QR (a foreign payload) is covered by the sticker's live
 * code, so every code in the hero opens the same tagged Peanut link. Boxes
 * are in % of the whole 451×900 capture: the code is its white card
 * (x 116–335, y 243–462), the scan window its pink frame (x 85–366, y 210–492).
 * On load the sticker settles and the scan line sweeps the pink window twice,
 * under the code. A tap on the scanner or the sticker opens what the CTA opens:
 * a phone cannot scan itself.
 */
export function QrArgentinaHeroArt() {
    return (
        <div className="relative w-full">
            <div className="ml-auto w-[84%] md:mr-3 md:w-[74%]">
                <QrArgentinaAppLink>
                    <div className="aspect-[451/520] overflow-hidden">
                        <div className="relative">
                            <Image
                                src={mantecaScanner}
                                alt="The Peanut scanner reading a QR"
                                className="h-auto w-full"
                                sizes="(min-width: 1024px) 430px, 300px"
                                priority
                            />
                            {/* The line sweeps the pink margins and passes behind the
                                code's white card, never across its finders. */}
                            <div
                                aria-hidden
                                className="absolute top-[23.33%] left-[18.8%] h-[31.33%] w-[62.3%] overflow-hidden"
                            >
                                <QrArgentinaScanLine className="qr-ar-scan qr-ar-hero-scan" />
                            </div>
                            <StarLpQrCode
                                campaign="qr-argentina"
                                slot="hero-sticker"
                                className="absolute top-[27%] left-[25.7%] w-[48.6%] overflow-hidden rounded-card"
                            />
                        </div>
                    </div>
                </QrArgentinaAppLink>
            </div>
            <DropIn
                fromTilt={-20}
                tilt={-6}
                delay={0.4}
                className="absolute top-[26%] left-0 z-10 w-[40%] md:top-[25%]"
            >
                <div className="qr-ar-settle">
                    <QrArgentinaSticker slot="hero-sticker" />
                </div>
            </DropIn>
        </div>
    )
}
