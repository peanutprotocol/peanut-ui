'use client'

/**
 * <ScaledShareAsset /> — renders <ShareAssetD3 /> scaled to fit its
 * container width.
 *
 * The asset is authored at native 1200×900 (CANVAS_W/CANVAS_H, see
 * shareAssetLayout). Scaling is delegated to useFitToWidth — same hook
 * the eligibility-check screen uses to fit PixelatedCardFace into mobile
 * viewports.
 *
 * The component forwards an imperative ref pointing at the inner
 * native-size element (the one BEFORE `transform: scale(...)`). Pass it
 * to <ShareAssetActions /> so capture/share/download work at full
 * 1200×900 fidelity regardless of current display scale.
 */

import { type ForwardedRef, forwardRef } from 'react'
import ShareAssetD3 from './ShareAssetD3'
import type { ShareAssetD3Props } from './shareAsset.types'
import { useFitToWidth } from '@/hooks/useFitToWidth'

export const SHARE_ASSET_NATIVE_W = 1200
export const SHARE_ASSET_NATIVE_H = 900

interface Props extends ShareAssetD3Props {
    /** Extra className for the outer host (the one ResizeObserver measures). */
    className?: string
}

export const ScaledShareAsset = forwardRef<HTMLDivElement, Props>(function ScaledShareAsset(
    { className, ...assetProps }: Props,
    captureRef: ForwardedRef<HTMLDivElement>
) {
    const { hostRef, scale } = useFitToWidth(SHARE_ASSET_NATIVE_W)

    // Use aspectRatio (not pixel-rounded height) so the host's measured
    // height matches the inner scaled-transform height to sub-pixel
    // precision. Without this the host could end up ~1px shorter than
    // the actual scaled content, clipping the bottom-pinned attribution.
    //
    // No `overflow: hidden` on the host — the inner <ShareAssetD3 /> root
    // already clips, and any layout decorations that extend outside the
    // 1200×900 frame should be visible, not clipped.
    return (
        <div
            ref={hostRef}
            className={className}
            style={{
                width: '100%',
                aspectRatio: `${SHARE_ASSET_NATIVE_W} / ${SHARE_ASSET_NATIVE_H}`,
                position: 'relative',
            }}
        >
            {scale > 0 && (
                <div
                    ref={captureRef}
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
})

export default ScaledShareAsset
