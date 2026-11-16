import Image from 'next/image'
import { LOGO, WORDMARK } from '@/assets/brand'
import { PEANUT_CARD_HAND, VISA_BRAND_MARK } from '@/assets/cards'

/**
 * The Peanut Card face as a UI object in sign-up art (mock kit.js `cardFace`): pink, logo and wordmark, the Visa mark,
 * "????" for the number and the approved card hand. No "Platinum". Sizes follow the mock's 250 px card.
 */
export function CardFace({ width }: { width: number }) {
    const s = width / 250
    const px = (n: number) => Math.round(n * s)
    const height = Math.round(width / 1.586)
    return (
        <div
            className="relative overflow-hidden border border-border-default bg-background-brand shadow-4"
            style={{ width, height, borderRadius: px(12) }}
            data-card-face
        >
            <Image
                src={LOGO}
                alt=""
                className="absolute w-auto"
                style={{ left: px(14), top: px(12), height: px(24) }}
            />
            <Image
                src={WORDMARK}
                alt=""
                className="absolute w-auto"
                style={{ left: px(38), top: px(17), height: px(13) }}
            />
            <Image
                src={VISA_BRAND_MARK}
                alt=""
                className="absolute w-auto"
                style={{ right: px(14), top: px(14), height: px(15) }}
            />
            <span
                className="absolute font-extrabold text-foreground-primary"
                style={{ left: px(16), bottom: px(14), fontSize: px(17), letterSpacing: px(2), lineHeight: 1 }}
            >
                ????
            </span>
            <Image
                src={PEANUT_CARD_HAND}
                alt=""
                className="absolute w-auto"
                style={{ right: -px(6), bottom: -px(4), height: Math.round(height * 0.9) }}
            />
        </div>
    )
}
