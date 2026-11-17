'use client'

import { type HTMLMotionProps, motion, useIsPresent } from 'framer-motion'
import Image from 'next/image'
import { useMemo } from 'react'
import coinEurFace from '@/assets/onboarding/coin-eur-face.svg'
import coinUsdFace from '@/assets/onboarding/coin-usd-face.svg'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { useSetupShell } from '@/components/Setup/redesign/shell/SetupShellContext'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { MoneyCard } from './MoneyCard'
import { useX1Walk } from './useX1Walk'
import { WalkingRig } from './WalkingRig'
import { COIN_KINDS, COIN_TOP, COIN_W, minBodyTop, RIG_H, RIG_W, rigFrame, SEAM, world, X1_LAYOUT } from './x1-walk'

const COIN_FACE = { usd: coinUsdFace, eur: coinEurFace }
const POP: [number, number, number, number] = [0.34, 1.56, 0.64, 1]

/** A doodle pops in once (scale 0 and -40 deg to rest); reduced motion shows it at rest. */
function popIn(animate: boolean, delay: number): HTMLMotionProps<'div'> {
    return {
        initial: animate ? { opacity: 0, scale: 0, rotate: -40 } : false,
        animate: { opacity: [0, 1, 1], scale: 1, rotate: 0 },
        transition: { duration: 0.3, delay, ease: POP, opacity: { duration: 0.3, delay, times: [0, 0.3, 1] } },
    }
}

/**
 * The 01 landing hero, X1 "coin bridge" (mock scaffold screens/01-landing): the walking peanut on a scrolling row of
 * USD and EUR coin faces, under the "Money received!" card, with a sparkle and a star. The walk is the one ruled motion
 * exception (MOTION.md 5a); everything else enters once and holds still. Reduced motion holds world frame 4.
 */
export function X1Hero() {
    const { reducedMotion } = useSetupShell()
    const isPresent = useIsPresent()
    const device = useShellDevice()
    const layout = X1_LAYOUT[device]
    const wf = useX1Walk(!reducedMotion && isPresent)
    const { coins, body } = world(device, wf)

    const [cardX, cardY, cardScale] = layout.card
    const [bandX, bandW] = layout.band
    const bandTop = Math.floor(COIN_TOP) - 4
    // The walker box is fixed: from the walk's highest body top to the seam, wide enough for the comp.
    const box = useMemo(() => {
        const x = Math.max(bandX, layout.left - 12)
        const y = Math.floor(minBodyTop(device)) - 6
        return { x, y, width: Math.min(layout.left + RIG_W + 12, bandX + bandW) - x, height: SEAM - y }
    }, [device, bandX, bandW, layout.left])
    const animate = !reducedMotion

    return (
        <div className="absolute inset-0" data-testid="landing-hero">
            <div
                className="absolute z-[3] overflow-hidden"
                style={{ left: bandX, top: bandTop, width: bandW, height: SEAM - bandTop }}
                aria-hidden="true"
                data-testid="landing-coin-band"
            >
                {COIN_KINDS.map((kind, i) => (
                    <div
                        key={i}
                        className="absolute left-0 will-change-transform"
                        style={{
                            top: COIN_TOP - bandTop,
                            width: COIN_W,
                            transform: `translateX(${(coins[i] - bandX).toFixed(2)}px)`,
                            // the coin further left stands in front
                            zIndex: 1000 - Math.round(coins[i]),
                        }}
                        data-coin-face={kind}
                    >
                        <Image src={COIN_FACE[kind]} alt="" className="block h-auto w-full" />
                    </div>
                ))}
            </div>
            <div
                className="absolute z-[5] overflow-hidden"
                style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
                aria-hidden="true"
                data-testid="landing-walker"
                data-world-frame={wf}
            >
                <div
                    className="absolute top-0 left-0 will-change-transform"
                    style={{
                        width: RIG_W,
                        height: RIG_H,
                        transform: `translate(${(layout.left - box.x).toFixed(2)}px, ${(body - box.y).toFixed(2)}px)`,
                    }}
                >
                    <WalkingRig frame={rigFrame(wf)} />
                </div>
            </div>
            <ArtPiece
                left={cardX}
                top={cardY}
                width={236}
                height={60}
                rotate={2}
                zIndex={6}
                style={cardScale === 1 ? undefined : { scale: cardScale, transformOrigin: '0 0' }}
            >
                <MoneyCard animate={animate} />
            </ArtPiece>
            <ArtPiece left={344} top={158} width={30} rotate={-20} zIndex={4} smHide>
                <motion.div {...popIn(animate, 0.56)}>
                    <Image src={sparkle} alt="" className="block h-auto w-full" />
                </motion.div>
            </ArtPiece>
            <ArtPiece left={110} top={312} width={26} zIndex={4} smHide>
                <motion.div {...popIn(animate, 0.62)}>
                    <Image src={star} alt="" className="block h-auto w-full" />
                </motion.div>
            </ArtPiece>
        </div>
    )
}
