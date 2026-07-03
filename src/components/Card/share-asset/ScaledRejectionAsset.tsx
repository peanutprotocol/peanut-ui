'use client'

/**
 * <ScaledRejectionAsset /> — renders <RejectionAssetD3 /> scaled to fit its
 * container width, forwarding a capture ref at the native 1200×900 node so
 * capture/share works at full fidelity. Mirrors <ScaledShareAsset />.
 */

import { type ComponentProps, type ForwardedRef, forwardRef } from 'react'
import RejectionAssetD3 from './RejectionAssetD3'
import { useFitToWidth } from '@/hooks/useFitToWidth'
import { CANVAS_W, CANVAS_H } from './shareAssetLayout'

type Props = ComponentProps<typeof RejectionAssetD3> & {
    /** Extra className for the outer host (the one ResizeObserver measures). */
    className?: string
}

export const ScaledRejectionAsset = forwardRef<HTMLDivElement, Props>(function ScaledRejectionAsset(
    { className, ...assetProps }: Props,
    captureRef: ForwardedRef<HTMLDivElement>
) {
    const { hostRef, scale } = useFitToWidth(CANVAS_W)

    return (
        <div
            ref={hostRef}
            className={className}
            style={{
                width: '100%',
                aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
                position: 'relative',
            }}
        >
            {scale > 0 && (
                <div
                    ref={captureRef}
                    style={{
                        width: CANVAS_W,
                        height: CANVAS_H,
                        transformOrigin: 'top left',
                        transform: `scale(${scale})`,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                    }}
                >
                    <RejectionAssetD3 {...assetProps} />
                </div>
            )}
        </div>
    )
})

export default ScaledRejectionAsset
