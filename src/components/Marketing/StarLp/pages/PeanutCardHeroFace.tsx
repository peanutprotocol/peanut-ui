import { PixelatedCardFace } from '@/components/Card/share-asset/PixelatedCardFace'
import { CARD_H, CARD_W } from '@/components/Card/share-asset/shareAssetLayout'
import type { PeanutCardHeroFaceProps } from './peanutCard.types'

// The face's offset shadow sits 0.625rem down and right (PixelatedCardFace),
// so a press moves the face exactly onto it and the shadow disappears.
const PRESS_CLASS =
    'transition-transform duration-100 motion-safe:group-active/card:translate-x-[0.625rem] motion-safe:group-active/card:translate-y-[0.625rem]'

/**
 * The hero card, scaled to its column in CSS alone, so it paints with the
 * server HTML (it is the LCP element) and with JS off. ScaledPixelatedCardFace
 * measures after mount instead, which leaves the hero blank until hydration.
 * `tan(atan2(100cqw, CARD_W px))` is the host width over the card's native
 * width as a plain number, which `scale()` needs.
 */
export function PeanutCardHeroFace({ pressable = false }: PeanutCardHeroFaceProps) {
    return (
        <div className="[container-type:inline-size] relative w-full" style={{ aspectRatio: `${CARD_W} / ${CARD_H}` }}>
            <div
                className="absolute top-0 left-0 origin-top-left"
                style={{
                    width: CARD_W,
                    height: CARD_H,
                    transform: `scale(min(1, tan(atan2(100cqw, ${CARD_W}px))))`,
                }}
            >
                <PixelatedCardFace className={pressable ? PRESS_CLASS : undefined} />
            </div>
        </div>
    )
}
