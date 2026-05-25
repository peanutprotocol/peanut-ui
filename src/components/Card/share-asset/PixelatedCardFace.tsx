/**
 * <PixelatedCardFace /> — the pink peanut card with a runtime-pixelated
 * `peanut-card-hand.svg` overlay.
 *
 * Renders at native 620×391 (CARD_W/CARD_H). Wrap in `transform: scale(...)`
 * if you need a smaller preview — the inner layout uses absolute pixel
 * offsets that scale linearly with the wrapper.
 *
 * Shared between <ShareAssetD3 /> (in-app share asset / dev-builder) and
 * the `/shhhhh` closed-beta landing page hero. Keep this file the single
 * source of truth for the pixelation algorithm — the module-level canvas
 * cache below means the SVG only gets re-rasterized once per session.
 */

'use client'

import { type FC, type CSSProperties } from 'react'
import { CARD_W, CARD_H } from './shareAssetLayout'
import { PEANUTMAN_LOGO } from '@/assets/peanut'
import PEANUT_CARD_HAND_ASSET from '@/assets/cards/peanut-card-hand.svg'
import VISA_BRAND_MARK_ASSET from '@/assets/cards/visa-brand-mark.png'

const ASSET_PEANUTMAN_LOGO = PEANUTMAN_LOGO.src
const ASSET_VISA_BRAND = VISA_BRAND_MARK_ASSET.src
const ASSET_CARD_HAND = PEANUT_CARD_HAND_ASSET.src

interface PixelatedCardFaceProps {
    last4?: string
    /** Extra classes for the outer card div (the pink rounded box). */
    className?: string
    /** Extra inline styles merged on top of the defaults (width/height/shadow). */
    style?: CSSProperties
    /** When true, blur every element on the card (logos, "•••• XXXX", Virtual
     *  pill) so the card silhouette is recognisable but no detail is legible.
     *  The pixelated hand stays sharp. Used by the /shhhhh closed-beta LP. */
    blurAll?: boolean
}

export const PixelatedCardFace: FC<PixelatedCardFaceProps> = ({
    last4 = 'XXXX',
    className,
    style,
    blurAll = false,
}) => (
    <div
        className={`relative overflow-hidden rounded-3xl border-[4px] border-black ${className ?? ''}`}
        style={{
            background: '#FF90E8',
            width: CARD_W,
            height: CARD_H,
            boxShadow: '0.625rem 0.625rem 0 #000',
            ...style,
        }}
    >
        <PixelatedHand />
        <div
            className="absolute flex items-start justify-between"
            style={{
                top: 24,
                left: 28,
                right: 28,
                zIndex: 2,
                filter: blurAll ? 'blur(14px) saturate(1.2)' : undefined,
            }}
        >
            <img src={ASSET_PEANUTMAN_LOGO} alt="" aria-hidden style={{ height: 52, width: 'auto' }} />
            <img
                src={ASSET_VISA_BRAND}
                alt="Visa"
                style={{ height: 32, width: 'auto', filter: 'brightness(0) invert(1)' }}
            />
        </div>
        <div
            className="absolute"
            style={{
                bottom: 24,
                left: 28,
                zIndex: 2,
                filter: blurAll ? 'blur(14px) saturate(1.2)' : undefined,
            }}
        >
            <div
                style={{
                    fontFamily: 'var(--font-roboto), sans-serif',
                    fontWeight: 1000,
                    letterSpacing: '0.06em',
                    fontSize: 38,
                    lineHeight: 1,
                }}
            >
                •••• {last4}
            </div>
            <span
                className="inline-block rounded-full border-[1.5px] border-black bg-white font-semibold"
                style={{ fontSize: 15, padding: '2px 14px', marginTop: 8 }}
            >
                Virtual
            </span>
        </div>
    </div>
)

// Module-level cache: rasterize the peanut-card-hand SVG into a tiny canvas
// exactly once per session. Subsequent mounts copy the cached pixels into a
// fresh canvas via drawImage (cheap), rather than re-decoding the SVG +
// re-running the initial drawImage (5-15ms each).
//
// NB: a canvas's drawing surface is NOT part of the DOM, so `cloneNode` does
// not duplicate pixel content — copying via `drawImage(cachedCanvas, …)` is
// the only correct approach.
//
// Server-side OG renderers (satori/sharp) will need their own pre-rasterized
// PNG; this client-side cache is only for in-app surfaces.
const PIXEL_SIZE = 36
let cachedHandCanvas: HTMLCanvasElement | null = null

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
    const out = document.createElement('canvas')
    out.width = source.width
    out.height = source.height
    out.getContext('2d')!.drawImage(source, 0, 0)
    return out
}

function makePixelatedHand(onReady: (canvas: HTMLCanvasElement) => void): void {
    if (cachedHandCanvas) {
        onReady(cloneCanvas(cachedHandCanvas))
        return
    }
    const img = new Image()
    img.decoding = 'async'
    img.onload = (): void => {
        const ratio = img.naturalWidth / img.naturalHeight || 1
        const cw = ratio > 1 ? PIXEL_SIZE : Math.max(1, Math.round(PIXEL_SIZE * ratio))
        const ch = ratio > 1 ? Math.max(1, Math.round(PIXEL_SIZE / ratio)) : PIXEL_SIZE
        const canvas = document.createElement('canvas')
        canvas.width = cw
        canvas.height = ch
        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, 0, 0, cw, ch)
        cachedHandCanvas = canvas
        // First call: hand the just-drawn canvas directly. There is no other
        // mount that could conflict on it yet (the cache was just populated).
        onReady(canvas)
    }
    img.src = ASSET_CARD_HAND
}

const PixelatedHand: FC = () => (
    <div
        ref={(node) => {
            if (!node || node.firstChild) return
            makePixelatedHand((canvas) => {
                canvas.style.width = '100%'
                canvas.style.height = '100%'
                canvas.style.imageRendering = 'pixelated'
                node.appendChild(canvas)
            })
        }}
        className="pointer-events-none absolute select-none"
        style={{
            top: -40,
            right: -20,
            width: 560,
            height: 471,
            transform: 'rotate(-15deg)',
            transformOrigin: 'center',
        }}
    />
)

export default PixelatedCardFace
