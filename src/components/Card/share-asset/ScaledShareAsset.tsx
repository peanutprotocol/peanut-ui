'use client'

/**
 * <ScaledShareAsset /> — renders <ShareAssetD3 /> scaled to fit its
 * container width.
 *
 * The asset is authored at native 1200×675 (Twitter summary_large_image).
 * Scaling is delegated to useFitToWidth — same hook the eligibility-check
 * screen uses to fit PixelatedCardFace into mobile viewports.
 */

import { type FC } from 'react'
import ShareAssetD3 from './ShareAssetD3'
import type { ShareAssetD3Props } from './shareAsset.types'
import { useFitToWidth } from '@/hooks/useFitToWidth'

export const SHARE_ASSET_NATIVE_W = 1200
export const SHARE_ASSET_NATIVE_H = 675

interface Props extends ShareAssetD3Props {
    /** Extra className for the outer host (the one ResizeObserver measures). */
    className?: string
}

export const ScaledShareAsset: FC<Props> = ({ className, ...assetProps }) => {
    const { hostRef, scale } = useFitToWidth(SHARE_ASSET_NATIVE_W)

    return (
        <div
            ref={hostRef}
            className={className}
            style={{
                width: '100%',
                // Reserve vertical space proportional to the scaled asset so
                // adjacent layout doesn't reflow once the measurement lands.
                height: scale > 0 ? SHARE_ASSET_NATIVE_H * scale : 'auto',
                aspectRatio:
                    scale > 0 ? undefined : `${SHARE_ASSET_NATIVE_W} / ${SHARE_ASSET_NATIVE_H}`,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {scale > 0 && (
                <div
                    style={{
                        width: SHARE_ASSET_NATIVE_W,
                        height: SHARE_ASSET_NATIVE_H,
                        transformOrigin: 'top left',
                        transform: `scale(${scale})`,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                    }}
                >
                    <ShareAssetD3 {...assetProps} />
                </div>
            )}
        </div>
    )
}

export default ScaledShareAsset
