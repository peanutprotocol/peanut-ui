/**
 * <PixelatedCardFace /> — the pink peanut card with the peanut-card-hand
 * overlay: crisp by default, blurred under `blurAll`.
 *
 * Renders at native CARD_W×CARD_H (see shareAssetLayout — don't restate the
 * numbers here, they drift). Wrap in `transform: scale(...)`
 * if you need a smaller preview — the inner layout uses absolute pixel
 * offsets that scale linearly with the wrapper. For width-fit, use
 * <ScaledPixelatedCardFace />.
 *
 * When `blurAll` is true the same crisp art (hand, logos, number) sits under
 * one CSS blur, so the card still reads as a card but nothing on it can be
 * made out. The card's edge and shadow stay sharp. There is no second,
 * pre-processed copy of the art to keep in step with the approved files.
 * The name is historical: the tease used to be chunky pixels.
 *
 * Shared between the internal share builder, application preview, and the
 * `/shhhhh` LP hero.
 */

'use client'

import { type FC, type CSSProperties } from 'react'
import { CARD_W, CARD_H } from './shareAssetLayout'
import { LOGO } from '@/assets/brand'
import PEANUT_CARD_HAND_ASSET from '@/assets/cards/peanut-card-hand.svg'
import VISA_BRAND_MARK_ASSET from '@/assets/cards/visa-brand-mark.png'

const ASSET_LOGO = LOGO.src
const ASSET_VISA_BRAND = VISA_BRAND_MARK_ASSET.src
const ASSET_CARD_HAND = PEANUT_CARD_HAND_ASSET.src

// The tease blur, in card px at native CARD_W (it scales down with the card). Strong enough that the logo,
// the Visa mark and the number cannot be read, light enough that the hand and the card still read as a card.
const TEASE_BLUR_PX = 12

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
    /** When true, everything on the card (hand, logos, number) sits under
     *  one CSS blur: clearly a card, details unreadable. */
    blurAll?: boolean
    /** When true, omit the Visa brand mark entirely. The share asset can't
     *  display the Visa wordmark for compliance reasons (it renders crisp
     *  there since the share asset is the one surface that doesn't `blurAll`). */
    hideVisa?: boolean
    /** Colour of the offset drop shadow. Defaults to the design-system black;
     *  the homepage door fold overrides it because a black shadow is invisible
     *  on that fold's black ground. */
    shadowColor?: string
    /** Fires once the hand <img> has loaded — i.e. the card face is fully
     *  painted. Capture surfaces gate the Share/Save buttons on this so a
     *  snapshot can never fire before the hand is ready. */
    onReady?: () => void
}

export const PixelatedCardFace: FC<PixelatedCardFaceProps> = ({
    className,
    style,
    blurAll = false,
    hideVisa = false,
    shadowColor = 'var(--color-shadow-primary)',
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
            style={{ inset: 0, background: shadowColor, transform: 'translate(0.625rem, 0.625rem)' }}
        />
        <div
            data-decorative-clip
            className={`relative h-full w-full overflow-hidden rounded-3xl border-[4px] border-black ${className ?? ''}`}
            style={{
                background: 'var(--color-background-brand)',
                ...style,
            }}
        >
            {/* One layer for everything on the card, so the tease is a single blur over the crisp art. */}
            <div
                className="absolute inset-0"
                style={blurAll ? { filter: `blur(${TEASE_BLUR_PX}px)` } : undefined}
                data-card-tease={blurAll ? 'blur' : undefined}
            >
                <CardHand onReady={onReady} />

                {/* Top row: peanut logo (left) + visa logo (right) */}
                <div
                    className="absolute flex items-start justify-between"
                    style={{ top: 24, left: 28, right: 28, zIndex: 2 }}
                >
                    <img src={ASSET_LOGO} alt="" aria-hidden style={{ height: 52, width: 'auto' }} />
                    {!hideVisa && (
                        <img
                            src={ASSET_VISA_BRAND}
                            alt="Visa"
                            style={{ height: 32, width: 'auto', filter: 'brightness(0) invert(1)' }}
                        />
                    )}
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
                </div>
            </div>
        </div>
    </div>
)

// ---------------------------------------------------------------------------
// The hand — always a plain <img>, NEVER a runtime <canvas>. html-to-image
// silently drops a live <canvas> it can't serialise (canvas.toDataURL() returns
// empty on iOS Safari for an SVG-sourced canvas → blank card, no error: the
// launch-day "blank share asset" bug), but inlines <img> reliably — same path
// the badge stickers and the peanut logo above take, which never blank.
// ---------------------------------------------------------------------------

const CardHand: FC<{ onReady?: () => void }> = ({ onReady }) => (
    <img
        src={ASSET_CARD_HAND}
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
            top: 5,
            right: -20,
            width: 560,
            height: 471,
            transform: 'rotate(-1deg)',
            transformOrigin: 'center',
        }}
    />
)

export default PixelatedCardFace
