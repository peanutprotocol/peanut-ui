'use client'

import PeanutMascot from '@/components/Global/PeanutMascot'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import { ArtPiece } from './ArtPiece'

/**
 * An approved peanut pose placed like the mock's `mascotHTML`: a 1050:1000 box (the whole Lottie comp) at
 * left/top/width in the art box's design px. The app's PeanutMascot plays it: the whole comp loops at 1.15x on
 * twos; reduced motion shows frame 0. Never move, mirror or recolour the box (mock MOTION.md rule 4).
 * Place a figure where a still stood with HOLD_BOX (shell.consts.ts): width W gives k = W / 1050, and the figure starts at
 * (x * k, y * k) inside the box.
 */
export function MascotStage({
    pose,
    left,
    top,
    width,
    beat,
    zIndex,
    smHide,
}: {
    pose: MascotPose
    left: number
    top: number
    width: number
    /** Change it to restart the loop from frame 0 on an event (04's found cheer). */
    beat?: string | number
    zIndex?: number
    smHide?: boolean
}) {
    return (
        <ArtPiece left={left} top={top} width={width} height={(width * 1000) / 1050} zIndex={zIndex} smHide={smHide}>
            <div className="mascot-lot absolute inset-0" data-mascot-lot={pose}>
                <PeanutMascot key={beat} pose={pose} fit="canvas" className="h-full w-full overflow-visible" />
            </div>
        </ArtPiece>
    )
}
