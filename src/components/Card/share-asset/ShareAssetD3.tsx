/**
 * <ShareAssetD3 /> — the in-app share asset that users can post or save
 * after they get their Peanut card.
 *
 * Asset is 1200×900 (4:3 — see CANVAS_W / CANVAS_H in shareAssetLayout.ts).
 * It's NOT a Twitter card image: the X intent (see share.utils.ts) is
 * text-only and doesn't include a URL, so there's no OG/twitter:image
 * scrape path. Capture is via captureShareAsset.ts (html-to-image at
 * native 1200×900, attached to navigator.share or downloaded).
 *
 * Composition is a sticker collage: the pixelated card sits in the middle
 * and the user's badges are slapped around it as big raw stickers. The
 * only text is the @username pill.
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
    usernameFontSize,
    type StampPlacement,
    type KeepoutEllipse,
} from './shareAssetLayout'
import type { ShareAssetD3Props, HeroMessage } from './shareAsset.types'
import { PixelatedCardFace } from './PixelatedCardFace'

// Peanut blue — the brand section colour reused from the prod landing page
// (LP `businessBgColor` in dropLink.tsx + the global `--background-color`).
const ASSET_BG = '#90A8ED'

const ANIM_CARD_DELAY = 100
const ANIM_STAMP_BASE_DELAY = 600
const ANIM_STAMP_STAGGER = 200
const ANIM_HERO_DELAY = 350
const ANIM_ATTRIBUTION_DELAY = 1700

// Hero message sits centred near the top of the canvas.
const HERO_TOP = 26
const HERO_CX = CANVAS_W / 2

/** Nominal pixel footprint of the hero sticker, used both to render it and to
 *  reserve a keep-out so badges don't cover it. Width grows with the copy. */
function heroGeometry(msg: HeroMessage): { w: number; h: number; fontSize: number } {
    const scale = msg.scale ?? 1
    const len = Math.max(msg.text.length, 4)
    if (msg.variant === 'burst') {
        const fontSize = 58 * scale
        const w = Math.max(320, len * fontSize * 0.58 + 180)
        const h = Math.max(240, fontSize + 150) * scale
        return { w, h, fontSize }
    }
    // pill + banner are single-line labels
    const fontSize = 60 * scale
    const h = fontSize + 40
    const w = Math.max(240, len * fontSize * 0.6 + 96)
    return { w, h, fontSize }
}

const USERNAME_BG: Record<NonNullable<ShareAssetD3Props['usernameStyle']>['bg'], string> = {
    white: '#FFFFFF',
    pink: '#FF90E8',
    blue: '#6E8BEF',
}

// The shipped look. Callers that omit these props (the real card-unlock share
// surfaces) get this; the /dev/share-builder passes its own to iterate.
const DEFAULT_HERO: HeroMessage = { variant: 'burst', text: "I'M IN!", scale: 1.15, tilt: 5 }
const DEFAULT_USERNAME_STYLE: Required<NonNullable<ShareAssetD3Props['usernameStyle']>> = {
    bg: 'white',
    prefixRatio: 0.5,
    scale: 1,
    letterSpacing: 0,
}

const ShareAssetD3: FC<ShareAssetD3Props> = ({
    username,
    badges,
    cardLast4,
    seedOverride,
    heroMessage,
    usernameStyle,
    animate = true,
}) => {
    const safeUsername = (username || '').trim() || 'anon'
    const safeLast4 = (cardLast4 || '').trim().padStart(4, '•').slice(-4) || '5695'

    // `undefined` (real callers) → the shipped default hero; `null` (builder
    // "none") → no hero.
    const resolvedHero = heroMessage === undefined ? DEFAULT_HERO : heroMessage
    const hero = resolvedHero && resolvedHero.text.trim() ? resolvedHero : null
    const heroGeo = useMemo(() => (hero ? heroGeometry(hero) : null), [hero?.text, hero?.variant, hero?.scale])

    const stickers = useMemo(() => {
        const extraKeepouts: KeepoutEllipse[] = heroGeo
            ? [{ cx: HERO_CX, cy: HERO_TOP + heroGeo.h / 2, rx: heroGeo.w / 2, ry: heroGeo.h / 2 }]
            : []
        return placeStamps(badges, new SeededRandom(seedOverride ?? safeUsername), extraKeepouts)
    }, [seedOverride, safeUsername, badges, heroGeo])

    // Username pill: "peanut.me/<handle>" — the prefix is rendered much smaller
    // than the handle. Colour + typography come from usernameStyle.
    const uHandleSize = usernameFontSize(safeUsername) * (usernameStyle?.scale ?? DEFAULT_USERNAME_STYLE.scale)
    const uPrefixSize = uHandleSize * (usernameStyle?.prefixRatio ?? DEFAULT_USERNAME_STYLE.prefixRatio)
    const uTracking = usernameStyle?.letterSpacing ?? DEFAULT_USERNAME_STYLE.letterSpacing
    const uBg = USERNAME_BG[usernameStyle?.bg ?? DEFAULT_USERNAME_STYLE.bg]

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
            `}</style>

            {/* ─── Background pattern (faint pink polka — texture, no content) ─── */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,144,232,0.45) 1px, transparent 1.5px)',
                    backgroundSize: '40px 40px',
                    opacity: 0.5,
                }}
            />

            {/* ─── The card (z-index 3) — sits in the middle of the collage ─── */}
            <div
                className="absolute"
                style={{
                    top: CARD_TOP,
                    left: CARD_LEFT,
                    zIndex: 3,
                    animation: animate
                        ? `cardSlide 800ms cubic-bezier(0.18, 0.89, 0.32, 1.28) ${ANIM_CARD_DELAY}ms both`
                        : 'none',
                }}
            >
                <PixelatedCardFace last4={safeLast4} hideVisa />
            </div>

            {/* ─── Stickers (z-index 4) — raw badge art collaged ON TOP of the
                 card. No frames, no chrome: the badge SVGs already carry a
                 white sticker border + thick outline, so they read as
                 peel-off stickers slapped over the card. ─── */}
            {stickers.map((s, i) => (
                <StickerEl
                    key={`s-${i}`}
                    sticker={s}
                    animate={animate}
                    delay={ANIM_STAMP_STAGGER * i + ANIM_STAMP_BASE_DELAY}
                />
            ))}

            {/* ─── @username pill — the sharer's own handle, the asset's
                "this is ME" anchor. Sits below the stickers (z-index 4) so a
                sticker that lands over it reads as slapped on top; the pill's
                repulsion keep-out keeps it mostly clear regardless. ─── */}
            <div
                className="absolute flex flex-col items-end"
                style={{
                    bottom: 48,
                    right: 56,
                    zIndex: 3,
                    animation: animate ? `fadeUp 600ms ease-out ${ANIM_ATTRIBUTION_DELAY}ms both` : 'none',
                }}
            >
                <span
                    className="inline-flex items-baseline rounded-full border-[5px] border-black"
                    style={{
                        backgroundColor: uBg,
                        padding: '10px 40px',
                        textTransform: 'lowercase',
                        boxShadow: '0.375rem 0.375rem 0 #000',
                        whiteSpace: 'nowrap',
                        maxWidth: 780,
                        overflow: 'hidden',
                        lineHeight: 1.05,
                        transform: 'rotate(-3deg)',
                        gap: 1,
                    }}
                >
                    <span style={{ fontSize: uPrefixSize, fontWeight: 800 }}>peanut.me/</span>
                    <span style={{ fontSize: uHandleSize, fontWeight: 1000, letterSpacing: `${uTracking}em` }}>
                        {safeUsername}
                    </span>
                </span>
            </div>

            {/* ─── Hero "I got in" message sticker (top, z-index 5 — above the
                collage). Its keep-out (computed above) keeps badges clear. ─── */}
            {hero && heroGeo && (
                <div
                    className="absolute flex justify-center"
                    style={{
                        top: HERO_TOP,
                        left: 0,
                        right: 0,
                        zIndex: 5,
                        animation: animate ? `fadeUp 600ms ease-out ${ANIM_HERO_DELAY}ms both` : 'none',
                    }}
                >
                    <HeroMessageEl hero={hero} geo={heroGeo} />
                </div>
            )}
        </div>
    )
}

// ─── Sub-components ────────────────────────────────────────────────────

interface StickerElProps {
    sticker: StampPlacement
    animate: boolean
    delay: number
}

// Raw badge sticker — just the SVG, rotated, with a hard offset shadow so
// it lifts off the card like a real peel-off sticker. No frame, no issuer
// text, no year: the badge art already has its own white sticker border.
const StickerEl: FC<StickerElProps> = ({ sticker, animate, delay }) => {
    const restTransform = `rotate(${sticker.rotation}deg)`
    return (
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

// Hero "I got in" message — three sticker treatments. All share the thick
// black outline + hard offset shadow of the collage so they read as one more
// (bigger) sticker slapped on top.
const HeroMessageEl: FC<{ hero: HeroMessage; geo: { w: number; h: number; fontSize: number } }> = ({ hero, geo }) => {
    const { text, variant } = hero
    const { w, h, fontSize } = geo
    // Tilt: explicit override, else a small per-variant lean.
    const tilt = hero.tilt ?? (variant === 'banner' ? -2 : variant === 'pill' ? -3 : -4)
    const rot = `rotate(${tilt}deg)`

    if (variant === 'pill') {
        return (
            <span
                className="inline-flex items-center justify-center rounded-full border-[6px] border-black bg-secondary-1"
                style={{
                    height: h,
                    padding: `0 ${fontSize * 0.7}px`,
                    fontFamily: 'var(--font-roboto), sans-serif',
                    fontSize,
                    fontWeight: 1000,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    boxShadow: '0.4rem 0.4rem 0 #000',
                    transform: rot,
                }}
            >
                {text}
            </span>
        )
    }

    if (variant === 'banner') {
        return (
            <span
                className="inline-flex items-center justify-center border-[6px] border-black bg-primary-1"
                style={{
                    height: h,
                    padding: `0 ${fontSize * 0.6}px`,
                    fontFamily: 'var(--font-roboto), sans-serif',
                    fontSize,
                    fontWeight: 1000,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    boxShadow: '0.4rem 0.4rem 0 #000',
                    transform: rot,
                }}
            >
                {text}
            </span>
        )
    }

    // burst — a yellow seal/starburst behind the text
    const points = burstSealPoints(w / 2, h / 2, 16, 0.6)
    return (
        <div style={{ position: 'relative', width: w, height: h, transform: rot }}>
            <svg
                width={w}
                height={h}
                viewBox={`0 0 ${w} ${h}`}
                style={{ position: 'absolute', inset: 0, filter: 'drop-shadow(0.4rem 0.4rem 0 #000)' }}
            >
                <polygon
                    points={points}
                    fill="#FFC900"
                    stroke="#000"
                    strokeWidth={7}
                    strokeLinejoin="round"
                    transform={`translate(${w / 2} ${h / 2})`}
                />
            </svg>
            <span
                className="absolute inset-0 flex items-center justify-center text-center"
                style={{
                    fontFamily: 'var(--font-roboto), sans-serif',
                    fontSize,
                    fontWeight: 1000,
                    letterSpacing: '-0.01em',
                    lineHeight: 0.95,
                    padding: '0 12%',
                }}
            >
                {text}
            </span>
        </div>
    )
}

/** Build an N-spike seal/starburst polygon centred on (0,0), to be translated
 *  to the sticker centre. Alternates outer (rx,ry) and inner radii. */
function burstSealPoints(rx: number, ry: number, spikes: number, innerRatio: number): string {
    const pts: string[] = []
    for (let i = 0; i < spikes * 2; i++) {
        const angle = (i * Math.PI) / spikes - Math.PI / 2
        const r = i % 2 === 0 ? 1 : innerRatio
        pts.push(`${(Math.cos(angle) * rx * r).toFixed(1)},${(Math.sin(angle) * ry * r).toFixed(1)}`)
    }
    return pts.join(' ')
}

export default ShareAssetD3
