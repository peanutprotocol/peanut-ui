'use client'

import type { AnimationItem } from 'lottie-web'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import coinEurRig from '@/assets/onboarding/coin-eur-rig.png'
import coinUsdRig from '@/assets/onboarding/coin-usd-rig.png'
import { twMerge } from '@/utils/tw'
import { ArtPiece, type ArtPieceProps } from './ArtPiece'
import { COIN_PASS, type CoinName, cutCoinRig } from './coinRig'
import { useSetupShell } from './SetupShellContext'

const STILL = { usd: coinUsdRig, eur: coinEurRig }

/**
 * A USD or EUR coin character, the only coin art in the flow (mock MOTION.md rule 5). A square box; the coin face
 * fills about 80 % of it. It shows the rig's frame 0 as a still, plays one rig pass `playAfterMs` after it mounts,
 * then holds frame 0. It never loops; reduced motion keeps the still.
 */
export function CoinCharacter({
    coin,
    left,
    top,
    size,
    playAfterMs,
    rotate,
    entrance,
    order,
    zIndex,
    smHide,
    className,
}: {
    coin: CoinName
    size: number
    /** Omit for a still coin. */
    playAfterMs?: number
} & Pick<ArtPieceProps, 'left' | 'top' | 'rotate' | 'entrance' | 'order' | 'zIndex' | 'smHide' | 'className'>) {
    const { reducedMotion } = useSetupShell()
    const host = useRef<HTMLSpanElement>(null)
    const [live, setLive] = useState(false)

    useEffect(() => {
        if (reducedMotion || playAfterMs === undefined || !host.current) return
        let cancelled = false
        let animation: AnimationItem | undefined
        let timer: ReturnType<typeof setTimeout> | undefined
        void Promise.all([import('lottie-web/build/player/lottie_light'), import('@/assets/onboarding/accounts.json')])
            .then(([lottie, rig]) => {
                if (cancelled || !host.current) return
                animation = lottie.default.loadAnimation({
                    container: host.current,
                    renderer: 'svg',
                    loop: false,
                    autoplay: false,
                    animationData: cutCoinRig(rig.default, coin),
                })
                animation.addEventListener('DOMLoaded', () => {
                    if (cancelled || !animation) return
                    animation.goToAndStop(0, true)
                    setLive(true)
                    timer = setTimeout(() => animation?.playSegments(COIN_PASS, true), playAfterMs)
                })
                animation.addEventListener('complete', () => animation?.goToAndStop(0, true))
            })
            // a decorative coin is not worth a chunk-error reload: the still stays
            .catch(() => {})
        return () => {
            cancelled = true
            clearTimeout(timer)
            animation?.destroy()
            setLive(false)
        }
    }, [coin, playAfterMs, reducedMotion])

    return (
        <ArtPiece
            left={left}
            top={top}
            width={size}
            height={size}
            rotate={rotate}
            entrance={entrance}
            order={order}
            zIndex={zIndex}
            smHide={smHide}
            className={twMerge('coin-char', className)}
        >
            <Image
                src={STILL[coin]}
                alt=""
                fill
                unoptimized
                className={twMerge('object-contain', live && 'opacity-0')}
                data-coin-still={coin}
            />
            <span ref={host} className={twMerge('absolute inset-0', !live && 'opacity-0')} data-coin={coin} />
        </ArtPiece>
    )
}
