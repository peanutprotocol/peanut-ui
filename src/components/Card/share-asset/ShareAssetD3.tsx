/**
 * <ShareAssetD3 /> — the Twitter share asset for card activation.
 *
 * Renders the floating-collage Design 3 from
 * `designs/2026-05-20-card-waitlist-flow/index.html` as a production
 * React component. Same shape works both client-side (with CSS-only
 * staggered animation on mount) and server-rendered (animations skipped,
 * final frame outputs deterministically — suitable for satori/sharp OG
 * routes).
 *
 * Sizing: this renders at native 1200×675. Wrap in a container that
 * scales via `transform: scale(...)` if you need a smaller preview.
 *
 * Branch ownership: card-rebuild agent (see WORKING.md).
 */

'use client'

import { type FC, useMemo } from 'react'
import { SeededRandom } from './seededRandom'
import {
    CANVAS_W,
    CANVAS_H,
    CARD_LEFT,
    CARD_TOP,
    CARD_ROTATION_DEG,
    placeStamps,
    placeDecorations,
    buildStatColumns,
    usernameFontSize,
    type StampPlacement,
    type DecorationPlacement,
} from './shareAssetLayout'
import type { ShareAssetD3Props, TierLevel } from './shareAsset.types'
import { TIER_0_BADGE, TIER_1_BADGE, TIER_2_BADGE, TIER_3_BADGE } from '@/assets/badges'
import { PEANUTMAN_WAVING, PEANUTMAN_RAISING_HANDS } from '@/assets/peanut'
import { STAR_STRAIGHT_ICON } from '@/assets/icons'
import { HandThumbsUp } from '@/assets'
import { PixelatedCardFace } from './PixelatedCardFace'

const ASSET_STAR = STAR_STRAIGHT_ICON.src
const ASSET_HAND_THUMBS = HandThumbsUp.src
const ASSET_PEANUTMAN_WAVING = PEANUTMAN_WAVING.src
const ASSET_PEANUT_HANDS = PEANUTMAN_RAISING_HANDS.src

const TIER_SVG: Record<TierLevel, string> = {
    0: TIER_0_BADGE,
    1: TIER_1_BADGE,
    2: TIER_2_BADGE,
    3: TIER_3_BADGE,
}

const TIER_LABEL: Record<TierLevel, string> = {
    0: 'TIER 0',
    1: 'TIER 1',
    2: 'TIER 2',
    3: 'TIER 3',
}

// Decoration kind → asset URL. Replaces a nested ternary in <DecorationEl>.
const DECO_ASSET: Record<DecorationPlacement['kind'], string> = {
    star: ASSET_STAR,
    thumbsUp: ASSET_HAND_THUMBS,
    peanutWaving: ASSET_PEANUTMAN_WAVING,
    peanutHands: ASSET_PEANUT_HANDS,
}

const ANIM_CARD_DELAY = 100
const ANIM_STAMP_BASE_DELAY = 600
const ANIM_STAMP_STAGGER = 250
const ANIM_TIER_DELAY = 1500
const ANIM_ATTRIBUTION_DELAY = 1700
const ANIM_EARNED_DELAY = 1900

const ShareAssetD3: FC<ShareAssetD3Props> = ({
    username,
    badges,
    stats,
    tier = 0,
    pointsBalance = 0,
    cardLast4,
    seedOverride,
    animate = true,
}) => {
    const safeUsername = (username || '').trim() || 'anon'
    const safeLast4 = (cardLast4 || '').trim().padStart(4, '•').slice(-4) || '5695'

    const { stamps, decorations, statCols } = useMemo(() => {
        const rng = new SeededRandom(seedOverride ?? safeUsername)
        return {
            stamps: placeStamps(badges, rng),
            decorations: placeDecorations(rng),
            statCols: buildStatColumns(stats),
        }
    }, [seedOverride, safeUsername, badges, stats])

    // "Truly new" users (tier 0 + 0 pts) hide the whole tier block — "TIER 0 / 0"
    // reads as "you have nothing", wrong vibe for a celebration asset.
    const showTierBlock = tier > 0 || pointsBalance > 0

    return (
        <div
            className="relative overflow-hidden border-2 border-black rounded-sm"
            style={{
                width: CANVAS_W,
                height: CANVAS_H,
                background: '#efe4ff',
                fontFamily: 'var(--font-roboto), system-ui, sans-serif',
            }}
        >
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
                @keyframes cardSlide {
                    0% {
                        opacity: 0;
                        transform: translate(-40px, 60px) rotate(-20deg);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(0, 0) rotate(${CARD_ROTATION_DEG}deg);
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
                @keyframes sparkle {
                    0% {
                        opacity: 0;
                        transform: scale(0.4) rotate(0deg);
                    }
                    100% {
                        opacity: var(--rest-opacity, 0.95);
                        transform: var(--rest-transform);
                    }
                }
            `}</style>

            {/* ─── Background pattern (faint pink polka) ─── */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage:
                        'radial-gradient(circle, rgba(255,144,232,0.45) 1px, transparent 1.5px)',
                    backgroundSize: '32px 32px',
                    opacity: 0.5,
                }}
            />

            {/* ─── Decorations (stars + thumbs-up + peanut chars) ─── */}
            {decorations.map((deco, i) => (
                <DecorationEl key={i} deco={deco} animate={animate} delay={50 * i + 800} />
            ))}

            {/* ─── Vertical editorial header (magazine spine) ─── */}
            <div
                className="absolute hero-caps text-black/55"
                style={{
                    left: 28,
                    top: '50%',
                    transform: 'translateY(-50%) rotate(-90deg)',
                    transformOrigin: 'left center',
                    whiteSpace: 'nowrap',
                    fontSize: 13,
                    letterSpacing: '0.4em',
                    fontWeight: 1000,
                    textTransform: 'uppercase',
                    zIndex: 1,
                }}
            >
                PEANUT.ME / {safeUsername.toUpperCase()} &nbsp;&nbsp; ✦ &nbsp;&nbsp; SHARE EDITION
            </div>

            {/* ─── EDITION header (top-left) ─── */}
            <div
                className="absolute"
                style={{ top: 36, left: 80, zIndex: 6, animation: animate ? `fadeUp 600ms ease-out ${ANIM_CARD_DELAY}ms both` : 'none' }}
            >
                <HeroCaps style={{ fontSize: 11, letterSpacing: '0.2em' }}>EDITION · 01</HeroCaps>
                <HeroCaps style={{ fontSize: 10, letterSpacing: '0.16em', opacity: 0.55, marginTop: 2 }}>
                    THE PEANUT CARD ARRIVES
                </HeroCaps>
            </div>

            {/* ─── Tier badge + stats anchor (top-left) ─── */}
            {(showTierBlock || statCols.length > 0) && (
                <div
                    className="absolute"
                    style={{
                        top: 124,
                        left: 56,
                        transform: 'rotate(-4deg)',
                        zIndex: 6,
                        animation: animate ? `fadeUp 700ms ease-out ${ANIM_TIER_DELAY}ms both` : 'none',
                    }}
                >
                    {showTierBlock && (
                        <div className="flex items-end gap-3">
                            <img
                                src={TIER_SVG[tier]}
                                alt=""
                                aria-hidden
                                style={{
                                    height: 124,
                                    width: 'auto',
                                    filter: 'drop-shadow(0.25rem 0.25rem 0 rgba(0,0,0,0.85))',
                                }}
                            />
                            <div style={{ paddingBottom: 6 }}>
                                <HeroCaps style={{ fontSize: 10, letterSpacing: '0.15em', opacity: 0.6 }}>
                                    {TIER_LABEL[tier]} · PEANUT PTS
                                </HeroCaps>
                                <HeroCaps style={{ fontSize: 38, lineHeight: 0.95 }}>
                                    {pointsBalance.toLocaleString('en-US')}
                                </HeroCaps>
                            </div>
                        </div>
                    )}
                    {/* Stats inline strip — renders only the cols present */}
                    {statCols.length > 0 && (
                        <div
                            className={`border-[2.5px] border-black bg-white inline-block ${showTierBlock ? 'mt-3' : ''}`}
                            style={{
                                padding: '6px 12px',
                                boxShadow: '0.125rem 0.125rem 0 #000',
                            }}
                        >
                            <div className="flex items-baseline" style={{ gap: 14 }}>
                                {statCols.map((col, i) => (
                                    <span key={col.label} className="flex items-baseline" style={{ gap: 14 }}>
                                        {i > 0 && <span className="text-black/30">·</span>}
                                        <span>
                                            <HeroCaps style={{ fontSize: 8, letterSpacing: '0.14em', opacity: 0.55 }}>
                                                {col.label}
                                            </HeroCaps>
                                            <HeroCaps style={{ fontSize: 14, lineHeight: 1 }}>{col.value}</HeroCaps>
                                        </span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Stamps BEHIND the card (z-index 2, below card's 3) ─── */}
            {stamps
                .filter((s) => s.behind)
                .map((s, i) => (
                    <StampEl
                        key={`b-${i}`}
                        stamp={s}
                        animate={animate}
                        delay={ANIM_STAMP_STAGGER * i + ANIM_STAMP_BASE_DELAY}
                    />
                ))}

            {/* ─── The card (z-index 3) ─── */}
            <div
                className="absolute"
                style={{
                    top: CARD_TOP,
                    left: CARD_LEFT,
                    zIndex: 3,
                    animation: animate ? `cardSlide 800ms cubic-bezier(0.18, 0.89, 0.32, 1.28) ${ANIM_CARD_DELAY}ms both` : 'none',
                }}
            >
                <PixelatedCardFace last4={safeLast4} />
            </div>

            {/* ─── Stamps IN FRONT (z-index 4) ─── */}
            {stamps
                .filter((s) => !s.behind)
                .map((s, i, frontList) => {
                    const behindCount = stamps.length - frontList.length
                    return (
                        <StampEl
                            key={`f-${i}`}
                            stamp={s}
                            animate={animate}
                            delay={ANIM_STAMP_STAGGER * (behindCount + i) + ANIM_STAMP_BASE_DELAY}
                        />
                    )
                })}

            {/* ─── EARNED ✓ rubber stamp (top-right) ─── */}
            <div
                className="absolute pointer-events-none"
                style={{
                    top: 184,
                    right: 138,
                    transform: 'rotate(-22deg)',
                    zIndex: 7,
                    animation: animate ? `fadeUp 500ms ease-out ${ANIM_EARNED_DELAY}ms both` : 'none',
                }}
            >
                <div
                    style={{
                        fontFamily: 'var(--font-roboto), sans-serif',
                        fontSize: 16,
                        fontWeight: 1000,
                        color: '#b3261e',
                        border: '3px solid #b3261e',
                        padding: '5px 14px',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.55)',
                        letterSpacing: '0.1em',
                        opacity: 0.85,
                        textTransform: 'uppercase',
                    }}
                >
                    EARNED ✓
                </div>
            </div>

            {/* ─── @username attribution (bottom-center) ─── */}
            <div
                className="absolute flex flex-col items-center"
                style={{
                    bottom: 22,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    gap: 8,
                    zIndex: 6,
                    animation: animate ? `fadeUp 600ms ease-out ${ANIM_ATTRIBUTION_DELAY}ms both` : 'none',
                }}
            >
                <HeroCaps style={{ fontSize: 12, letterSpacing: '0.18em', opacity: 0.65 }}>
                    Who invited you? ↓
                </HeroCaps>
                <span
                    className="border-[3px] border-black rounded-full bg-secondary-1 inline-block"
                    style={{
                        fontSize: usernameFontSize(safeUsername),
                        padding: '5px 24px',
                        fontWeight: 1000,
                        textTransform: 'uppercase',
                        letterSpacing: '-0.01em',
                        boxShadow: '0.125rem 0.125rem 0 #000',
                        whiteSpace: 'nowrap',
                        maxWidth: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    @{safeUsername}
                </span>
            </div>
        </div>
    )
}

// ─── Sub-components ────────────────────────────────────────────────────

const HeroCaps: FC<{ children: React.ReactNode; style?: React.CSSProperties; className?: string }> = ({
    children,
    style,
    className,
}) => (
    <div
        className={className}
        style={{
            fontFamily: 'var(--font-roboto), sans-serif',
            fontWeight: 1000,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            lineHeight: 0.92,
            color: '#000',
            ...style,
        }}
    >
        {children}
    </div>
)

interface StampElProps {
    stamp: StampPlacement
    animate: boolean
    delay: number
}

const StampEl: FC<StampElProps> = ({ stamp, animate, delay }) => {
    const restTransform = `rotate(${stamp.rotation}deg)`
    return (
        <figure
            className="absolute stamp"
            style={{
                width: stamp.width,
                height: stamp.height,
                top: stamp.top,
                left: stamp.left,
                transform: restTransform,
                zIndex: stamp.behind ? 2 : 4,
                ['--stamp-bg' as string]: '#efe4ff',
                ['--rest-transform' as string]: restTransform,
                animation: animate ? `stampDrop 700ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both` : 'none',
            }}
        >
            {stamp.withTape && (
                <div
                    className="absolute"
                    style={{
                        top: -4,
                        left: '50%',
                        transform: 'translateX(-50%) rotate(8deg)',
                        width: 88,
                        height: 22,
                        background:
                            'linear-gradient(rgba(255,201,0,0.5),rgba(255,201,0,0.5)),repeating-linear-gradient(90deg,transparent 0,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)',
                        borderLeft: '1px dashed rgba(0,0,0,0.15)',
                        borderRight: '1px dashed rgba(0,0,0,0.15)',
                        zIndex: 6,
                    }}
                />
            )}
            <span className="stamp-issuer">PEANUT</span>
            {stamp.badge.year && <span className="stamp-denom">{stamp.badge.year}</span>}
            <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ paddingTop: '5%', paddingBottom: '15%' }}
            >
                <img
                    src={stamp.badge.iconUrl}
                    alt=""
                    aria-hidden
                    style={{ maxWidth: '88%', maxHeight: '70%', objectFit: 'contain' }}
                />
            </div>
            <figcaption
                className="absolute"
                style={{
                    left: 8,
                    right: 8,
                    bottom: 10,
                    textAlign: 'center',
                    border: '1.5px solid #000',
                    background: stamp.badge.captionBg,
                    fontFamily: 'var(--font-roboto), sans-serif',
                    fontWeight: 1000,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    fontSize: stamp.width >= 170 ? 12 : 11,
                    padding: '2px 0',
                    color: '#000',
                }}
            >
                {stamp.badge.caption}
            </figcaption>
        </figure>
    )
}

const DecorationEl: FC<{ deco: DecorationPlacement; animate: boolean; delay: number }> = ({
    deco,
    animate,
    delay,
}) => {
    const src = DECO_ASSET[deco.kind]
    const restTransform = `rotate(${deco.rotation}deg)`
    const opacity = deco.kind === 'star' ? 0.85 : 0.95
    return (
        <img
            src={src}
            alt=""
            aria-hidden
            className="absolute select-none pointer-events-none"
            style={{
                top: deco.top,
                bottom: deco.bottom,
                left: deco.left,
                right: deco.right,
                width: deco.size,
                height: 'auto',
                opacity,
                transform: restTransform,
                zIndex: 1,
                ['--rest-transform' as string]: restTransform,
                ['--rest-opacity' as string]: opacity,
                animation: animate ? `sparkle 500ms cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both` : 'none',
            }}
        />
    )
}

export default ShareAssetD3
