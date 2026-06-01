'use client'

/**
 * <ScaledPixelatedCardFace /> — wraps <PixelatedCardFace /> with
 * auto-fit-to-container-width scaling. Used wherever the card needs to
 * sit inside a flex column (eligibility-check screen, /shhhhh hero).
 *
 * Reuses the same useFitToWidth hook ScaledShareAsset uses, so the
 * scaling math + measure timing stays consistent across the surface.
 */

import { type FC } from 'react'
import { PixelatedCardFace, type PixelatedCardFaceProps } from './PixelatedCardFace'
import { CARD_W, CARD_H } from './shareAssetLayout'
import { useFitToWidth } from '@/hooks/useFitToWidth'

interface Props extends PixelatedCardFaceProps {
    /** Optional extra class on the outer host (ResizeObserver target). */
    hostClassName?: string
}

export const ScaledPixelatedCardFace: FC<Props> = ({ hostClassName, ...cardProps }) => {
    const { hostRef, scale } = useFitToWidth(CARD_W)

    return (
        <div
            ref={hostRef}
            className={hostClassName}
            style={{
                width: '100%',
                height: scale > 0 ? CARD_H * scale : 'auto',
                aspectRatio: scale > 0 ? undefined : `${CARD_W} / ${CARD_H}`,
                position: 'relative',
                overflow: 'visible',
            }}
        >
            {scale > 0 && (
                <div
                    style={{
                        width: CARD_W,
                        height: CARD_H,
                        transformOrigin: 'top left',
                        transform: `scale(${scale})`,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                    }}
                >
                    <PixelatedCardFace {...cardProps} />
                </div>
            )}
        </div>
    )
}

export default ScaledPixelatedCardFace
