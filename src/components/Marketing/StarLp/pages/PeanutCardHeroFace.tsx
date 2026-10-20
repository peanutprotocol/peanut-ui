import { PixelatedCardFace } from '@/components/Card/share-asset/PixelatedCardFace'
import { CARD_H, CARD_W } from '@/components/Card/share-asset/shareAssetLayout'

/**
 * The hero card, scaled to its column in CSS alone, so it paints with the
 * server HTML (it is the LCP element) and with JS off. ScaledPixelatedCardFace
 * measures after mount instead, which leaves the hero blank until hydration.
 * `tan(atan2(100cqw, CARD_W px))` is the host width over the card's native
 * width as a plain number, which `scale()` needs.
 */
export function PeanutCardHeroFace() {
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
                <PixelatedCardFace />
            </div>
        </div>
    )
}
