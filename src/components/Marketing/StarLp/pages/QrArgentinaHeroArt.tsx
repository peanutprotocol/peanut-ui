import Image from 'next/image'
import mantecaScanner from '@/assets/iphone-ss/manteca_ss.webp'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { StarLpQrCode } from '@/components/Marketing/StarLp/StarLpQrCode'
import { QrArgentinaAppLink } from './QrArgentinaAppLink'
import { QrArgentinaScanLine } from './QrArgentinaScanLine'
import { QrArgentinaSticker } from './QrArgentinaSticker'

/**
 * The till's QR sticker next to the real Peanut scanner. The capture is cut
 * above its network labels (only the scanner and its frame show), and the
 * cut fades out so the phone reads as rising from below.
 *
 * The capture's own QR (a foreign payload) is covered by the sticker's live
 * code, so every code in the hero opens the same tagged Peanut link. Its box
 * is the capture's white card, in % of the 451×500 crop (x 116–335, y 243–462).
 * On load the sticker settles and the scan line sweeps the pink window twice,
 * under the code. A tap on the scanner or the sticker opens what the CTA opens:
 * a phone cannot scan itself.
 */
export function QrArgentinaHeroArt() {
    return (
        <div className="relative mx-auto w-full max-w-sm md:max-w-md">
            <div className="relative ml-auto w-[64%] rotate-3">
                <QrArgentinaAppLink className="relative">
                    <div className="aspect-[451/500] overflow-hidden [mask-image:linear-gradient(to_bottom,black_88%,transparent)]">
                        <Image
                            src={mantecaScanner}
                            alt="The Peanut scanner reading a QR"
                            className="h-auto w-full"
                            sizes="(min-width: 768px) 290px, 64vw"
                            priority
                        />
                    </div>
                    {/* the capture's pink scanner window: x 85–366, y 210–492 of the crop.
                        It sits under the code, so the line sweeps the pink margins and
                        passes behind the code's white card, never across its finders. */}
                    <div aria-hidden className="absolute top-[42%] left-[18.8%] h-[56.4%] w-[62.3%] overflow-hidden">
                        <QrArgentinaScanLine className="qr-ar-scan qr-ar-hero-scan" />
                    </div>
                    <StarLpQrCode
                        campaign="qr-argentina"
                        slot="hero-sticker"
                        className="absolute top-[48.6%] left-[25.7%] w-[48.6%] overflow-hidden rounded-[6%]"
                    />
                </QrArgentinaAppLink>
            </div>
            <DropIn fromTilt={-20} tilt={-6} delay={0.4} className="absolute top-[22%] left-0 z-10 w-[38%]">
                <div className="qr-ar-settle">
                    <QrArgentinaSticker slot="hero-sticker" />
                </div>
            </DropIn>
        </div>
    )
}
