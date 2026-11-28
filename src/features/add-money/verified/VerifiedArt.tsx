'use client'

import Image from 'next/image'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { CoinCharacter } from '@/components/Setup/redesign/shell/CoinCharacter'
import OnboardingAnimation from '@/components/Setup/redesign/shell/OnboardingAnimation'

// [left, top, width, sparkle] in art-box px, placed after the verified.png mock
const STARS: [number, number, number, boolean][] = [
    [88, 72, 32, true],
    [44, 244, 22, false],
    [332, 216, 24, false],
]

/**
 * The verified page's hero: the onboarding add-money wallet loop, the USD and EUR coins and stars, popping in as
 * the Celebration's art does. Pieces sit in the 390-wide art box of a std stage, above the headline.
 */
export function VerifiedArt() {
    return (
        <div className="absolute inset-0" data-testid="verified-art">
            <ArtPiece left={60} top={36} width={270} height={257} entrance="pop" order={0} zIndex={4}>
                <OnboardingAnimation name="add-money" background />
            </ArtPiece>
            <CoinCharacter
                coin="usd"
                left={14}
                top={118}
                size={78}
                rotate={-14}
                entrance="pop"
                order={2}
                playAfterMs={900}
                zIndex={5}
            />
            <CoinCharacter
                coin="eur"
                left={298}
                top={104}
                size={76}
                rotate={12}
                entrance="pop"
                order={3}
                playAfterMs={960}
                zIndex={5}
            />
            {STARS.map(([left, top, width, isSparkle], i) => (
                <ArtPiece
                    key={`${left}-${top}`}
                    left={left}
                    top={top}
                    width={width}
                    rotate={isSparkle ? -20 : 0}
                    entrance="pop"
                    order={4 + i}
                    zIndex={7}
                    smHide
                >
                    <Image src={isSparkle ? sparkle : star} alt="" className="block h-auto w-full" />
                </ArtPiece>
            ))}
        </div>
    )
}
