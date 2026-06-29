/**
 * <PixelatedCardFace /> — the pink peanut card with a pre-pixelated
 * peanut-card-hand overlay.
 *
 * Renders at native 620×391 (CARD_W/CARD_H). Wrap in `transform: scale(...)`
 * if you need a smaller preview — the inner layout uses absolute pixel
 * offsets that scale linearly with the wrapper. For width-fit, use
 * <ScaledPixelatedCardFace />.
 *
 * When `blurAll` is true (the closed-beta tease), the visa logo, peanut
 * logo, card number, and Virtual pill all get rasterised through a
 * canvas → image-rendering:pixelated pipeline, with a shared CELL_PX cell
 * size — so every detail on the card is hidden by consistent chunky pixels
 * instead of a mix of pixelation + CSS blur.
 *
 * Shared between <ShareAssetD3 />, the eligibility-check screen, and the
 * `/shhhhh` LP hero. Keep this file the single source of truth for the
 * pixelation algorithm — the module-level canvas cache means assets are
 * decoded once per session.
 */

'use client'

import { type FC, type CSSProperties } from 'react'
import { CARD_W, CARD_H } from './shareAssetLayout'
import { PEANUTMAN_LOGO } from '@/assets/mascot'
import PEANUT_CARD_HAND_PIXEL_ASSET from '@/assets/cards/peanut-card-hand-pixel.png'
import VISA_BRAND_MARK_ASSET from '@/assets/cards/visa-brand-mark.png'

const ASSET_PEANUTMAN_LOGO = PEANUTMAN_LOGO.src
const ASSET_VISA_BRAND = VISA_BRAND_MARK_ASSET.src
const ASSET_CARD_HAND_PIXEL = PEANUT_CARD_HAND_PIXEL_ASSET.src

// Shared pixel-cell target across every element on the card. Each
// element rasterises to (displayPx / CELL_PX) pixels then stretches back
// up with `image-rendering: pixelated`, so the visible "blockiness" looks
// uniform regardless of element size.
const CELL_PX = 14

export interface PixelatedCardFaceProps {
    /** Kept in the type for in-app surfaces that render the real card
     *  number — the share-asset rendering deliberately ignores this and
     *  always shows "????" so a screenshot can't leak the PAN. */
    last4?: string
    /** Extra classes for the pink rounded card face. Sizing is fixed at
     *  CARD_W×CARD_H on the wrapper — scale via <ScaledPixelatedCardFace />. */
    className?: string
    /** Extra inline styles merged onto the pink card face (e.g. background). */
    style?: CSSProperties
    /** When true, every element on the card (logos, number, pill) is run
     *  through the same canvas-rasterisation pipeline as the hand so the
     *  whole card reads as chunky pixels, not a mix of pixels + blur. */
    blurAll?: boolean
    /** When true, omit the Visa brand mark entirely. The share asset can't
     *  display the Visa wordmark for compliance reasons (it renders crisp
     *  there since the share asset is the one surface that doesn't `blurAll`). */
    hideVisa?: boolean
    /** Fires once the pixelated hand <img> has loaded — i.e. the card face is
     *  fully painted. Capture surfaces gate the Share/Save buttons on this so a
     *  snapshot can never fire before the hand is ready. */
    onReady?: () => void
}

export const PixelatedCardFace: FC<PixelatedCardFaceProps> = ({
    className,
    style,
    blurAll = false,
    hideVisa = false,
    onReady,
}) => (
    // The drop-shadow is an offset sibling, NOT a CSS box-shadow: html-to-image
    // renders box-shadow on a rounded element as a SQUARE block, so the captured
    // PNG showed a square shadow behind the rounded card. A real black rounded
    // element shifted by the shadow distance captures faithfully.
    <div className="relative" style={{ width: CARD_W, height: CARD_H }}>
        <div
            aria-hidden
            className="pointer-events-none absolute rounded-3xl"
            style={{ inset: 0, background: '#000', transform: 'translate(0.625rem, 0.625rem)' }}
        />
        <div
            className={`relative h-full w-full overflow-hidden rounded-3xl border-[4px] border-black ${className ?? ''}`}
            style={{
                background: '#FF90E8',
                ...style,
            }}
        >
            <PixelatedHand onReady={onReady} />

            {/* Top row: peanut logo (left) + visa logo (right) */}
            <div
                className="absolute flex items-start justify-between"
                style={{ top: 24, left: 28, right: 28, zIndex: 2 }}
            >
                {blurAll ? (
                    <PixelatedImg src={ASSET_PEANUTMAN_LOGO} displayW={52} displayH={52} />
                ) : (
                    <img src={ASSET_PEANUTMAN_LOGO} alt="" aria-hidden style={{ height: 52, width: 'auto' }} />
                )}
                {!hideVisa &&
                    (blurAll ? (
                        <PixelatedImg src={ASSET_VISA_BRAND} displayW={80} displayH={32} invert />
                    ) : (
                        <img
                            src={ASSET_VISA_BRAND}
                            alt="Visa"
                            style={{ height: 32, width: 'auto', filter: 'brightness(0) invert(1)' }}
                        />
                    ))}
            </div>

            {/* Bottom: card number — same `•••• ????` pattern in both modes.
            The share asset deliberately obscures the real PAN so a
            screenshot can't leak it; the eligibility-check tease uses
            the same string for visual continuity. (The `last4` prop is
            still in the type for in-app surfaces that show the real
            card face — share-asset + tease callers just don't pass it.)
            Lowered toward the card edge now that the Virtual pill is
            gone — gives the layout room to breathe. */}
            <div className="absolute" style={{ bottom: 32, left: 28, zIndex: 2 }}>
                {blurAll ? (
                    <PixelatedText
                        text="????"
                        displayW={140}
                        displayH={42}
                        font="1000 42px Roboto, sans-serif"
                        color="#000"
                    />
                ) : (
                    <div
                        style={{
                            fontFamily: 'var(--font-roboto), sans-serif',
                            fontWeight: 1000,
                            letterSpacing: '0.06em',
                            fontSize: 42,
                            lineHeight: 1,
                        }}
                    >
                        ????
                    </div>
                )}
            </div>
        </div>
    </div>
)

// ---------------------------------------------------------------------------
// Canvas raster helpers — shared pixelation pipeline for every element.
// ---------------------------------------------------------------------------

// Module-level cache: each unique asset src + raster resolution is decoded
// at most once per session. A canvas's drawing surface isn't cloneable via
// cloneNode, so we copy pixels with drawImage(cachedCanvas, ...) into a
// fresh canvas for each mount.
const rasterCache = new Map<string, HTMLCanvasElement>()

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
    const out = document.createElement('canvas')
    out.width = source.width
    out.height = source.height
    out.getContext('2d')!.drawImage(source, 0, 0)
    return out
}

function rasterImg(src: string, rasterW: number, rasterH: number, onReady: (canvas: HTMLCanvasElement) => void): void {
    const key = `${src}|${rasterW}x${rasterH}`
    const cached = rasterCache.get(key)
    if (cached) {
        onReady(cloneCanvas(cached))
        return
    }
    const img = new Image()
    img.decoding = 'async'
    img.onload = (): void => {
        const canvas = document.createElement('canvas')
        canvas.width = rasterW
        canvas.height = rasterH
        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(img, 0, 0, rasterW, rasterH)
        rasterCache.set(key, canvas)
        onReady(canvas)
    }
    img.src = src
}

interface PixelatedImgProps {
    src: string
    displayW: number
    displayH: number
    /** When true, render the image as white (visa brand is dark; we want it
     *  bright on the pink card). Applies a `brightness(0) invert(1)` filter
     *  before rasterisation. */
    invert?: boolean
}

const PixelatedImg: FC<PixelatedImgProps> = ({ src, displayW, displayH, invert }) => {
    const rasterW = Math.max(1, Math.round(displayW / CELL_PX))
    const rasterH = Math.max(1, Math.round(displayH / CELL_PX))
    return (
        <div
            ref={(node) => {
                if (!node || node.firstChild) return
                rasterImg(src, rasterW, rasterH, (canvas) => {
                    canvas.style.width = `${displayW}px`
                    canvas.style.height = `${displayH}px`
                    canvas.style.imageRendering = 'pixelated'
                    if (invert) canvas.style.filter = 'brightness(0) invert(1)'
                    node.appendChild(canvas)
                })
            }}
            style={{ width: displayW, height: displayH }}
        />
    )
}

interface PixelatedTextProps {
    text: string
    displayW: number
    displayH: number
    /** Canvas font shorthand (e.g. "1000 38px Roboto, sans-serif"). */
    font: string
    color: string
    /** Fill background colour before drawing the text (for the Virtual pill). */
    bg?: string
    /** Border colour drawn 1 raster-px inside the canvas edge. */
    borderColor?: string
}

const PixelatedText: FC<PixelatedTextProps> = ({ text, displayW, displayH, font, color, bg, borderColor }) => {
    // Use a slightly finer cell for text so glyphs remain just-readable as
    // blocky shapes; pure CELL_PX/14 produces unreadable mush at this size.
    const textCellPx = 6
    const rasterW = Math.max(1, Math.round(displayW / textCellPx))
    const rasterH = Math.max(1, Math.round(displayH / textCellPx))
    // Scale the font size proportionally to the canvas resolution so the
    // glyphs fill the raster correctly before being upscaled.
    const fontScale = rasterH / displayH
    return (
        <div
            ref={(node) => {
                if (!node || node.firstChild) return
                const canvas = document.createElement('canvas')
                canvas.width = rasterW
                canvas.height = rasterH
                const ctx = canvas.getContext('2d')!
                ctx.imageSmoothingEnabled = false
                if (bg) {
                    ctx.fillStyle = bg
                    ctx.fillRect(0, 0, rasterW, rasterH)
                }
                if (borderColor) {
                    ctx.strokeStyle = borderColor
                    ctx.lineWidth = 1
                    ctx.strokeRect(0.5, 0.5, rasterW - 1, rasterH - 1)
                }
                ctx.fillStyle = color
                // Replace the px size inside the canvas-font shorthand with the
                // raster-scaled px size. The original string drives styling
                // (weight, family); we only adjust the numeric size.
                ctx.font = font.replace(
                    /(\d+(?:\.\d+)?)px/,
                    (_, n) => `${Math.max(1, Math.round(Number(n) * fontScale))}px`
                )
                ctx.textBaseline = 'middle'
                ctx.textAlign = 'left'
                ctx.fillText(text, 1, rasterH / 2)
                canvas.style.width = `${displayW}px`
                canvas.style.height = `${displayH}px`
                canvas.style.imageRendering = 'pixelated'
                canvas.style.display = 'inline-block'
                node.appendChild(canvas)
            }}
            style={{ display: 'inline-block' }}
        />
    )
}

// ---------------------------------------------------------------------------
// The hand — a pre-pixelated PNG rendered as a plain <img>, NOT a runtime
// <canvas>. html-to-image silently drops a live <canvas> it can't serialise
// (canvas.toDataURL() returns empty on iOS Safari for an SVG-sourced canvas →
// blank card, no error: the launch-day "blank share asset" bug), but inlines
// <img> reliably — same path the badge stickers take, which never blank. The
// PNG is authored at the 36px raster and upscaled by image-rendering:pixelated,
// so it reads identically to the old canvas.
// ---------------------------------------------------------------------------

const PixelatedHand: FC<{ onReady?: () => void }> = ({ onReady }) => (
    <img
        src={ASSET_CARD_HAND_PIXEL}
        alt=""
        aria-hidden
        draggable={false}
        onLoad={() => onReady?.()}
        ref={(img) => {
            // A cached image can already be `complete` before React attaches
            // onLoad, so the load event never fires — that would leave the
            // capture gate stuck disabled. Fire onReady directly in that case.
            if (img?.complete) onReady?.()
        }}
        className="pointer-events-none absolute select-none"
        style={{
            top: -40,
            right: -20,
            width: 560,
            height: 471,
            transform: 'rotate(-15deg)',
            transformOrigin: 'center',
            imageRendering: 'pixelated',
        }}
    />
)

export default PixelatedCardFace
