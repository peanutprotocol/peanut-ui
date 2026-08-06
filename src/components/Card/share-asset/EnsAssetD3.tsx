/**
 * <EnsAssetD3 /> — the ENS-reveal share asset ("IT'S MY NAME").
 *
 * Sibling of <ShareAssetD3 /> on the same machinery: 1200×900 canvas,
 * force-directed badge stickers (placeStamps), the offset-shadow pill
 * construction, captureShareAsset for export. The card face is gone —
 * the user's ENS name is the hero, sat on a white starburst with a pink
 * shadow-burst behind it (peanut-yellow field).
 *
 * Design locked Aug 5 (ENS share-asset picker, V2 "yellow flip").
 */

'use client'

import { type FC, useEffect, useMemo } from 'react'
import { SeededRandom } from './seededRandom'
import {
    CANVAS_W,
    CANVAS_H,
    burstSealPoints,
    placeStamps,
    usernameFontSize,
    type StampPlacement,
    type KeepoutEllipse,
} from './shareAssetLayout'
import type { EnsAssetD3Props } from './shareAsset.types'

const ASSET_BG = '#FFC900' // yellow-1 / secondary-1

// Burst geometry — centred slightly above canvas middle so the footer row
// breathes. The pink twin sits offset down-right like a hard shadow.
const BURST_CX = 600
const BURST_CY = 415
const BURST_RX = 545
const BURST_RY = 452
const BURST_SPIKES = 16
const BURST_INNER = 0.74
const BURST_SHADOW_DX = 26
const BURST_SHADOW_DY = 28

const HEADLINE_TOP = 288
const PILL_TOP = 424
const TAGLINE_TOP = 566

const ANIM_BURST_DELAY = 100
const ANIM_HEADLINE_DELAY = 350
const ANIM_STAMP_BASE_DELAY = 600
const ANIM_STAMP_STAGGER = 200
const ANIM_TAGLINE_DELAY = 1400

// Keep badges off the text zone (headline + pill + tagline) and off the two
// fixed marks. Burst spike TIPS are fair game — corner stickers overlapping
// them is the collage look.
const ENS_KEEPOUTS: readonly KeepoutEllipse[] = [
    { cx: BURST_CX, cy: BURST_CY + 40, rx: 430, ry: 330 }, // text core
    { cx: 195, cy: 745, rx: 210, ry: 200 }, // ens circle sticker + air
    { cx: 985, cy: 785, rx: 200, ry: 90 }, // "pay me by name" chip
    { cx: 210, cy: 866, rx: 260, ry: 60 }, // footer lockup strip
]

const EnsAssetD3: FC<EnsAssetD3Props> = ({
    username,
    badges,
    seedOverride,
    hideUsername = false,
    animate = true,
    onReady,
}) => {
    const safeUsername = (username || '').trim() || 'anon'

    // No async card face here — the asset is capture-ready on mount.
    useEffect(() => {
        onReady?.()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const uHandleSize = usernameFontSize(safeUsername)
    const uSuffixSize = uHandleSize * 0.52

    const stickers = useMemo(
        () =>
            placeStamps(badges, new SeededRandom(seedOverride ?? safeUsername), ENS_KEEPOUTS, {
                // No bottom-right pill on this asset — push its keep-out off-canvas.
                x0: CANVAS_W + 1000,
                y0: CANVAS_H + 1000,
            }),
        [badges, seedOverride, safeUsername]
    )

    const whitePoints = burstSealPoints(BURST_RX, BURST_RY, BURST_SPIKES, BURST_INNER)

    return (
        <div
            className="relative overflow-hidden rounded-sm border-2 border-black"
            style={{
                width: CANVAS_W,
                height: CANVAS_H,
                background: ASSET_BG,
                fontFamily: 'var(--font-roboto), system-ui, sans-serif',
            }}
        >
            {/* eslint-disable-next-line react/no-unknown-property -- styled-jsx `jsx` attr */}
            <style jsx>{`
                @keyframes stampDrop {
                    0% {
                        opacity: 0;
                        transform: translateY(-80px) rotate(0deg) scale(0.7);
                    }
                    60% {
                        opacity: 1;
                        transform: var(--rest-transform) scale(1.08);
                    }
                    100% {
                        opacity: 1;
                        transform: var(--rest-transform);
                    }
                }
                @keyframes burstPop {
                    0% {
                        opacity: 0;
                        transform: rotate(-2deg) scale(0.82);
                    }
                    100% {
                        opacity: 1;
                        transform: rotate(-2deg) scale(1);
                    }
                }
                @keyframes fadeUp {
                    0% {
                        opacity: 0;
                        transform: translateY(14px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `}</style>

            {/* ─── Background texture — same polka the card asset uses ─── */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.10) 1.5px, transparent 2px)',
                    backgroundSize: '40px 40px',
                    opacity: 0.6,
                }}
            />

            {/* ─── Double starburst (z 2) — pink shadow twin, white on top ─── */}
            <svg
                className="absolute"
                style={{
                    left: 0,
                    top: 0,
                    overflow: 'visible',
                    zIndex: 2,
                    animation: animate
                        ? `burstPop 500ms cubic-bezier(0.34, 1.56, 0.64, 1) ${ANIM_BURST_DELAY}ms both`
                        : 'none',
                    transform: 'rotate(-2deg)',
                    transformOrigin: `${BURST_CX}px ${BURST_CY}px`,
                }}
                width={CANVAS_W}
                height={CANVAS_H}
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            >
                <polygon
                    points={whitePoints}
                    fill="#FF90E8"
                    stroke="#000"
                    strokeWidth={7}
                    strokeLinejoin="round"
                    transform={`translate(${BURST_CX + BURST_SHADOW_DX} ${BURST_CY + BURST_SHADOW_DY})`}
                />
                <polygon
                    points={whitePoints}
                    fill="#FFFFFF"
                    stroke="#000"
                    strokeWidth={8}
                    strokeLinejoin="round"
                    transform={`translate(${BURST_CX} ${BURST_CY})`}
                />
            </svg>

            {/* ─── Headline (z 5) ─── */}
            <div
                className="absolute text-center"
                style={{
                    top: HEADLINE_TOP,
                    left: 0,
                    right: 0,
                    zIndex: 5,
                    transform: 'rotate(-6deg)',
                    fontSize: 96,
                    fontWeight: 1000,
                    letterSpacing: '-0.01em',
                    lineHeight: 1,
                    animation: animate ? `fadeUp 600ms ease-out ${ANIM_HEADLINE_DELAY}ms both` : 'none',
                }}
            >
                IT&apos;S MY NAME
            </div>

            {/* ─── ENS name pill (z 5) — the machine's pill construction:
                 offset-shadow sibling (box-shadow captures square on
                 rounded-full), rotation on the wrapper. Format is the ENS
                 name itself: <handle>.peanut.me. ─── */}
            <div
                className="absolute flex justify-center"
                style={{
                    top: PILL_TOP,
                    left: 0,
                    right: 0,
                    zIndex: 5,
                    visibility: hideUsername ? 'hidden' : 'visible',
                    animation: animate ? `fadeUp 600ms ease-out ${ANIM_HEADLINE_DELAY + 150}ms both` : 'none',
                }}
            >
                <div className="relative inline-flex" style={{ transform: 'rotate(-3deg)' }}>
                    <div
                        aria-hidden
                        className="pointer-events-none absolute rounded-full"
                        style={{ inset: 0, background: '#000', transform: 'translate(0.375rem, 0.375rem)' }}
                    />
                    <span
                        className="relative inline-flex items-baseline rounded-full border-[5px] border-black bg-black text-white"
                        style={{
                            padding: '14px 44px',
                            textTransform: 'lowercase',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.05,
                            gap: 1,
                        }}
                    >
                        <span style={{ fontSize: uHandleSize, fontWeight: 1000 }}>{safeUsername}</span>
                        <span style={{ fontSize: uSuffixSize, fontWeight: 800, opacity: 0.85 }}>.peanut.me</span>
                    </span>
                </div>
            </div>

            {/* ─── Deadpan tagline (z 5) ─── */}
            <div
                className="absolute text-center"
                style={{
                    top: TAGLINE_TOP,
                    left: 0,
                    right: 0,
                    zIndex: 5,
                    transform: 'rotate(-2deg)',
                    fontSize: 30,
                    fontWeight: 600,
                    opacity: 0.72,
                    animation: animate ? `fadeUp 600ms ease-out ${ANIM_TAGLINE_DELAY}ms both` : 'none',
                }}
            >
                didn&apos;t buy it. got paid at it.
            </div>

            {/* ─── Badge stickers (z 4) — the user's real badges, collaged
                 around the burst exactly like the card asset ─── */}
            {stickers.map((s, i) => (
                <EnsStickerEl
                    key={`s-${i}`}
                    sticker={s}
                    animate={animate}
                    delay={ANIM_STAMP_STAGGER * i + ANIM_STAMP_BASE_DELAY}
                />
            ))}

            {/* ─── ens die-cut circle (z 5, fixed bottom-left) ─── */}
            <div
                className="absolute flex items-center justify-center rounded-full border-[7px] border-black bg-white"
                style={{
                    left: 120,
                    bottom: 96,
                    width: 150,
                    height: 150,
                    zIndex: 5,
                    transform: 'rotate(-8deg)',
                    filter: 'drop-shadow(0.6rem 0.6rem 0 rgba(0,0,0,0.28))',
                    animation: animate ? `fadeUp 600ms ease-out ${ANIM_TAGLINE_DELAY + 150}ms both` : 'none',
                }}
            >
                <span style={{ fontSize: 46, fontWeight: 800, color: '#5298FF' }}>ens</span>
            </div>

            {/* ─── "pay me by name" chip (z 5, fixed bottom-right) ─── */}
            <div
                className="absolute"
                style={{
                    right: 88,
                    bottom: 110,
                    zIndex: 5,
                    animation: animate ? `fadeUp 600ms ease-out ${ANIM_TAGLINE_DELAY + 300}ms both` : 'none',
                }}
            >
                <div className="relative inline-flex" style={{ transform: 'rotate(6deg)' }}>
                    <div
                        aria-hidden
                        className="pointer-events-none absolute rounded-full"
                        style={{ inset: 0, background: '#000', transform: 'translate(0.375rem, 0.375rem)' }}
                    />
                    <span
                        className="relative inline-flex rounded-full border-[5px] border-black"
                        style={{ backgroundColor: '#FF90E8', padding: '12px 34px', fontSize: 30, fontWeight: 800 }}
                    >
                        pay me by name
                    </span>
                </div>
            </div>

            {/* ─── Footer lockup (z 5, bottom-left corner) ─── */}
            <div
                className="absolute flex items-center"
                style={{ left: 44, bottom: 26, zIndex: 5, gap: 12, fontSize: 26, fontWeight: 800, opacity: 0.9 }}
            >
                <span style={{ color: '#5298FF' }}>ens</span>
                <span>×</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/peanut-logo.svg" alt="" aria-hidden style={{ height: 30 }} />
                <span>peanut.me</span>
            </div>
        </div>
    )
}

// Same raw-sticker treatment as the card asset's StickerEl.
const EnsStickerEl: FC<{ sticker: StampPlacement; animate: boolean; delay: number }> = ({
    sticker,
    animate,
    delay,
}) => {
    const restTransform = `rotate(${sticker.rotation}deg)`
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={sticker.badge.iconUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute select-none"
            style={{
                width: sticker.width,
                height: sticker.height,
                top: sticker.top,
                left: sticker.left,
                objectFit: 'contain',
                transform: restTransform,
                zIndex: 4,
                filter: 'drop-shadow(0.22rem 0.22rem 0 rgba(0,0,0,0.9))',
                ['--rest-transform' as string]: restTransform,
                animation: animate ? `stampDrop 700ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both` : 'none',
            }}
        />
    )
}

export default EnsAssetD3
