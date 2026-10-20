import Image from 'next/image'
import mantecaScanner from '@/assets/iphone-ss/manteca_ss.webp'
import { Wiggle } from '@/components/Marketing/StarLp/Wiggle'
import { QrBrazilPixSticker } from './QrBrazilPixSticker'

/**
 * The hero art: a "Pague com Pix" sticker beside the real Peanut scanner.
 * The capture is cropped above its network labels and fades out at the foot.
 * No scroll entrance: the art is above the fold and must paint with the page.
 */
export function QrBrazilHeroScene() {
    return (
        <div className="relative mx-auto aspect-[10/7] w-full max-w-md">
            <div className="absolute top-0 right-[2%] w-[58%] rotate-3">
                <div
                    className="aspect-[451/520] overflow-hidden"
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
                </div>
            </div>
            <div className="absolute top-[16%] left-[4%] z-10 w-[36%] -rotate-6">
                <Wiggle kind="wobble" className="w-full">
                    <QrBrazilPixSticker priority />
                </Wiggle>
            </div>
        </div>
    )
}
