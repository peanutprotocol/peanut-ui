'use client'

import Image from 'next/image'
import { useLayoutEffect, useRef, useState } from 'react'
import sparkle from '@/assets/illustrations/sparkle.svg'
import star from '@/assets/illustrations/star.svg'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { MascotStage } from '@/components/Setup/redesign/shell/MascotStage'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { PasskeyBrackets } from './PasskeyBrackets'
import { PasskeyMiniPhone } from './PasskeyMiniPhone'

// Mock 03-passkey screen.js LAYOUT, in design px. Small phones get a shorter phone and no stars.
const LAYOUT = {
    std: {
        brackets: { left: 22, top: 186, width: 170, height: 214 },
        mascot: { left: -24, top: 171, width: 259 },
        phone: { left: 214, top: 170, width: 156, height: 264, sheetHeight: 162 },
        stars: [
            { left: 196, top: 178, width: 22, sparkle: false },
            { left: 16, top: 168, width: 20, sparkle: true },
            { left: 190, top: 404, width: 18, sparkle: false },
        ],
    },
    sm: {
        brackets: { left: 26, top: 206, width: 162, height: 196 },
        mascot: { left: -15, top: 192, width: 236 },
        phone: { left: 214, top: 198, width: 156, height: 236, sheetHeight: 150 },
        stars: [],
    },
} as const

/**
 * The phone's bottom edge in both layouts: on a small phone a two-line headline scales the hero from this line
 * (mock .pk-tall). The approved 390 stills keep the hero at full size under the two-line headline.
 */
const FEET_LINE = 434
const TALL_SCALE = 0.9

/** True while the screen's headline runs to more than one line (mock 03 watchTitle). */
function useTwoLineTitle(enabled: boolean) {
    const ref = useRef<HTMLDivElement>(null)
    const [tall, setTall] = useState(false)
    useLayoutEffect(() => {
        const title = ref.current?.closest('[data-setup-art-layer]')?.querySelector('h1')
        if (!enabled || !title) {
            setTall(false)
            return
        }
        const fit = () => setTall(title.offsetHeight > parseFloat(getComputedStyle(title).lineHeight) * 1.5)
        fit()
        const observer = new ResizeObserver(fit)
        observer.observe(title)
        return () => observer.disconnect()
    }, [enabled])
    return { ref, tall }
}

/** The 03 hero: the too-cool peanut in the face-scan brackets beside the small phone that asks for the passkey. */
export function PasskeyHeroArt({ username, asking, flash }: { username: string; asking: boolean; flash: number }) {
    const device = useShellDevice()
    const layout = LAYOUT[device]
    const { ref, tall } = useTwoLineTitle(device === 'sm')
    return (
        <div
            ref={ref}
            className="absolute inset-0"
            style={{ transform: tall ? `scale(${TALL_SCALE})` : undefined, transformOrigin: `50% ${FEET_LINE}px` }}
            data-passkey-hero
        >
            <PasskeyBrackets {...layout.brackets} flash={flash} />
            <MascotStage pose="too-cool" {...layout.mascot} zIndex={6} />
            <PasskeyMiniPhone {...layout.phone} username={username} asking={asking} />
            {layout.stars.map((piece, index) => (
                <ArtPiece
                    key={`${piece.left}:${piece.top}`}
                    left={piece.left}
                    top={piece.top}
                    width={piece.width}
                    rotate={piece.sparkle ? -20 : 0}
                    entrance="pop"
                    order={5 + index}
                    smHide
                    zIndex={7}
                >
                    <Image src={piece.sparkle ? sparkle : star} alt="" className="h-auto w-full" />
                </ArtPiece>
            ))}
        </div>
    )
}
