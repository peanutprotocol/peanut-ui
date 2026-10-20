import Image from 'next/image'
import mantecaScanner from '@/assets/iphone-ss/manteca_ss.webp'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import { QrArgentinaSticker } from './QrArgentinaSticker'

/**
 * The till's QR sticker next to the real Peanut scanner. The capture is cut
 * above its network labels (only the scanner and its frame show), and the
 * cut fades out so the phone reads as rising from below.
 */
export function QrArgentinaHeroArt() {
    return (
        <div className="relative mx-auto w-full max-w-sm md:max-w-md">
            <div className="ml-auto w-[64%] rotate-3">
                <div className="aspect-[451/500] overflow-hidden [mask-image:linear-gradient(to_bottom,black_82%,transparent)]">
                    <Image
                        src={mantecaScanner}
                        alt="The Peanut scanner reading a QR"
                        className="h-auto w-full"
                        sizes="(min-width: 768px) 290px, 64vw"
                        priority
                    />
                </div>
            </div>
            <DropIn fromTilt={-20} tilt={-6} delay={0.4} className="absolute top-[22%] left-0 z-10 w-[38%]">
                <QrArgentinaSticker />
            </DropIn>
        </div>
    )
}
