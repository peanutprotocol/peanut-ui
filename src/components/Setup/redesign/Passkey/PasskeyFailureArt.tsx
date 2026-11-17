'use client'

import Image from 'next/image'
import star from '@/assets/illustrations/star.svg'
import type { MascotPose } from '@/components/Global/PeanutMascot/PeanutMascot.types'
import { ArtPiece } from '@/components/Setup/redesign/shell/ArtPiece'
import { MascotStage } from '@/components/Setup/redesign/shell/MascotStage'
import { useShellDevice } from '@/components/Setup/redesign/shell/useShellDevice'
import { PasskeyBrackets } from './PasskeyBrackets'
import type { PasskeyScreenState } from './passkeyScreenState'

type Box = { left: number; top: number; width: number }
type FailureLayout = {
    pose: MascotPose
    mascot: Box
    stars: Array<{ left: number; top: number; width: number }>
    brackets?: { left: number; top: number; width: number; height: number }
}

// Mock 03-passkey screen.js mount(), per failure state and device, in design px.
function failureLayout(state: PasskeyScreenState, sm: boolean): FailureLayout {
    switch (state) {
        case 'failed-android':
        case 'failed-ios':
            return {
                pose: 'worried',
                brackets: { left: 266, top: 112, width: 108, height: 172 },
                mascot: { left: 230, top: 92, width: 197 },
                stars: [{ left: 240, top: 250, width: 20 }],
            }
        case 'taken':
            return sm
                ? {
                      pose: 'worried',
                      mascot: { left: 238, top: 120, width: 201 },
                      stars: [{ left: 250, top: 250, width: 20 }],
                  }
                : {
                      pose: 'worried',
                      mascot: { left: 48, top: 148, width: 314 },
                      stars: [
                          { left: 300, top: 236, width: 22 },
                          { left: 64, top: 262, width: 20 },
                      ],
                  }
        case 'cannot-create':
            return {
                pose: 'thinking',
                mascot: sm ? { left: 252, top: 127, width: 195 } : { left: 225, top: 88, width: 235 },
                stars: [{ left: 254, top: 250, width: 20 }],
            }
        default:
            return sm
                ? {
                      pose: 'thinking',
                      mascot: { left: 252, top: 127, width: 195 },
                      stars: [{ left: 254, top: 250, width: 20 }],
                  }
                : {
                      pose: 'thinking',
                      mascot: { left: 65, top: 170, width: 291 },
                      stars: [
                          { left: 300, top: 244, width: 22 },
                          { left: 74, top: 270, width: 18 },
                      ],
                  }
    }
}

/** The hero of a 03 failure screen: the worried or thinking peanut (in wobbling brackets on the failed screens). */
export function PasskeyFailureArt({ state }: { state: PasskeyScreenState }) {
    const layout = failureLayout(state, useShellDevice() === 'sm')
    return (
        <>
            {layout.brackets && <PasskeyBrackets {...layout.brackets} wobble />}
            <MascotStage pose={layout.pose} {...layout.mascot} zIndex={6} />
            {layout.stars.map((piece, index) => (
                <ArtPiece
                    key={`${piece.left}:${piece.top}`}
                    {...piece}
                    entrance="pop"
                    delay={0.3}
                    order={index}
                    smHide
                    zIndex={7}
                >
                    <Image src={star} alt="" className="h-auto w-full" />
                </ArtPiece>
            ))}
        </>
    )
}
