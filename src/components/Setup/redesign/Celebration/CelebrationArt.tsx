'use client'

import Image from 'next/image'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { CoinCharacter } from '@/components/Setup/redesign/shell/CoinCharacter'
import { MascotStage } from '@/components/Setup/redesign/shell/MascotStage'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'

// [left, top, width, sparkle] in art-box px (mock screens/12-celebration)
const STARS: [number, number, number, boolean][] = [
    [150, 128, 30, false],
    [346, 252, 22, false],
    [22, 360, 20, false],
    [236, 104, 26, true],
    [318, 440, 18, false],
    [52, 436, 16, false],
]

/**
 * 12 hero: the approved whistling peanut (`waving-chill`, the old PeanutWhistling; owner ruling 17 Nov) (it loops), the USD coin left and the EUR coin right as drawn (the pink
 * EUR coin on the pink ground: no recolour, rim, outline or filter), stars. The art moves as one object
 * (mock r9 S10/S11): 24 px higher in `default` on a standard phone; in `claim-link` it grows about 1.12x and
 * moves down to meet the shorter copy. With the verify invite on a small phone, the footer lifts the copy, so the
 * art shrinks from its top edge to keep the feet clear of the headline.
 */
export function CelebrationArt({ claim, invite = false }: { claim: boolean; invite?: boolean }) {
    const sm = useShellDevice() === 'sm'
    // the mock moves the scaled art box in screen px; inside the box a small phone's 0.67 scale applies, so divide.
    // On a standard phone the mock's box hangs from the phone's bottom edge, home bar included; the shell's stage ends
    // above the bottom safe area, so the box moves down by it.
    const smInvite = invite && sm && !claim
    const transform = smInvite
        ? 'scale(0.88)'
        : claim
          ? sm
              ? `translateY(${Math.round(63 / 0.67)}px) scale(1.12)`
              : 'translateY(calc(97px + var(--safe-bottom))) scale(1.1236)'
          : sm
            ? undefined
            : 'translateY(calc(var(--safe-bottom) - 24px))'
    return (
        <div
            className="absolute inset-0"
            style={{ transform, transformOrigin: smInvite ? '50% 0' : '50% 100%' }}
            data-testid="setup-redesign-art"
        >
            {/* the whistling pose is wider than the cheering one: narrower and centred so the claim-link 1.12x scale keeps both
                hands on screen, feet where the cheering peanut stood */}
            <MascotStage pose="waving-chill" left={25} top={146} width={340} zIndex={4} />
            <CoinCharacter
                coin="usd"
                left={20}
                top={140}
                size={100}
                rotate={-14}
                entrance="pop"
                order={2}
                playAfterMs={900}
                zIndex={5}
            />
            <CoinCharacter
                coin="eur"
                left={284}
                top={128}
                size={96}
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
