/**
 * <RejectionAssetD3 /> — the "not tonight" rejection share asset.
 *
 * Shown to a user who passed the eligibility hold but doesn't hold a card-
 * access badge: instead of the celebration collage, they get a Berghain-
 * style door rejection they can share. The rejection markets the door's
 * exclusivity, and the share tags @joinpeanut via the caption (every caption
 * in rejectionCaptions.ts carries the handle).
 *
 * Visual: stark, near-black field. "not tonight, <username>" in big white and
 * an optional smug peanut mascot on the left (the bouncer, mocking you). The
 * @joinpeanut tag is intentionally NOT drawn on the asset — it rides the
 * caption, not the pixels. The scarcity tally ("applicants tonight…") also
 * lives in the screen HTML around the asset, NOT on the image.
 *
 * Authored at native 1200×900 (same frame as the win asset) so it flows
 * through the same capture/share pipeline.
 */

'use client'

import { type FC } from 'react'
import { CANVAS_W, CANVAS_H } from './shareAssetLayout'
import type { RejectionMascot } from './shareAsset.types'
import { PeanutTooCool, PeanutPointing, PeanutWhistling } from '@/assets/mascot'

const MASCOT_SRC: Record<Exclude<RejectionMascot, 'none'>, string> = {
    cool: PeanutTooCool.src, // pixel shades, hand on hip — "not cool enough"
    mock: PeanutPointing.src, // grinning + pointing — point and laugh
    chill: PeanutWhistling.src, // whistling, peace-sign — dismissive "whatever"
}

interface RejectionAssetProps {
    username: string
    /** Leading line. Default "not tonight,". */
    prefix?: string
    /** Which mascot to slap on the left. 'none' hides it. */
    mascot?: RejectionMascot
    /** Mascot size multiplier. */
    mascotScale?: number
    /** Background fill (near-black). */
    bg?: string
    /** Headline cap height in px + tracking in em. */
    headlineSize?: number
    headlineTracking?: number
    /** Subtle edge darkening for depth, 0–1. */
    vignette?: number
    animate?: boolean
}

const DEFAULT_BG = '#0a0b0f' // near-black, faint cold-blue tint

const ANIM_HEADLINE_DELAY = 150
const ANIM_MASCOT_DELAY = 350

const RejectionAssetD3: FC<RejectionAssetProps> = ({
    username,
    prefix = 'not tonight,',
    mascot = 'cool',
    mascotScale = 1,
    bg = DEFAULT_BG,
    headlineSize = 130,
    headlineTracking = -0.02,
    vignette = 0.35,
    animate = true,
}) => {
    const safeUsername = (username || '').trim() || 'anon'
    const hasMascot = mascot !== 'none'
    const mascotSrc = hasMascot ? MASCOT_SRC[mascot] : null

    // Mascot eats the left third; the headline lives in the remaining space.
    const mascotH = 640 * mascotScale
    const textLeft = hasMascot ? 470 : 80
    const textRight = 80

    // Auto-shrink the username so long handles still fit the text column.
    const colW = CANVAS_W - textLeft - textRight
    const unameSize = Math.min(headlineSize, (colW / Math.max(safeUsername.length, 5)) * 1.7)

    return (
        <div
            className="relative overflow-hidden rounded-sm"
            style={{
                width: CANVAS_W,
                height: CANVAS_H,
                background: bg,
                fontFamily: 'var(--font-roboto), system-ui, sans-serif',
            }}
        >
            {/* eslint-disable-next-line react/no-unknown-property -- styled-jsx `jsx` attr, same pattern as ShareAssetD3 */}
            <style jsx>{`
                @keyframes riseIn {
                    0% {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes mascotIn {
                    0% {
                        opacity: 0;
                        transform: translateX(-40px) rotate(-4deg);
                    }
                    100% {
                        opacity: 1;
                        transform: translateX(0) rotate(0deg);
                    }
                }
            `}</style>

            {/* ─── Subtle vignette for depth (no spotlight) ─── */}
            {vignette > 0 && (
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                        background: `radial-gradient(ellipse 92% 86% at 50% 46%, transparent 55%, rgba(0,0,0,${vignette}) 100%)`,
                    }}
                />
            )}

            {/* ─── Mascot (left) — the bouncer, mocking you ─── */}
            {mascotSrc && (
                <img
                    src={mascotSrc}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute select-none"
                    style={{
                        left: -24,
                        bottom: -20,
                        height: mascotH,
                        width: 'auto',
                        zIndex: 2,
                        filter: 'drop-shadow(0 8px 30px rgba(0,0,0,0.5))',
                        animation: animate
                            ? `mascotIn 600ms cubic-bezier(0.18,0.89,0.32,1.28) ${ANIM_MASCOT_DELAY}ms both`
                            : 'none',
                    }}
                />
            )}

            {/* ─── Headline — "not tonight, <username>" ─── */}
            <div
                className="absolute flex flex-col justify-center"
                style={{
                    top: 0,
                    bottom: 0,
                    left: textLeft,
                    right: textRight,
                    zIndex: 4,
                    alignItems: hasMascot ? 'flex-start' : 'center',
                    textAlign: hasMascot ? 'left' : 'center',
                    animation: animate ? `riseIn 600ms ease-out ${ANIM_HEADLINE_DELAY}ms both` : 'none',
                }}
            >
                <span
                    style={{
                        color: 'rgba(255,255,255,0.92)',
                        fontWeight: 1000,
                        fontSize: headlineSize,
                        lineHeight: 0.96,
                        letterSpacing: `${headlineTracking}em`,
                        textTransform: 'lowercase',
                    }}
                >
                    {prefix}
                </span>
                <span
                    style={{
                        color: '#fff',
                        fontWeight: 1000,
                        fontSize: unameSize,
                        lineHeight: 1,
                        letterSpacing: `${headlineTracking}em`,
                        textTransform: 'lowercase',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textShadow: '0 4px 40px rgba(150,180,255,0.25)',
                    }}
                >
                    {safeUsername}
                </span>
            </div>
        </div>
    )
}

export default RejectionAssetD3
