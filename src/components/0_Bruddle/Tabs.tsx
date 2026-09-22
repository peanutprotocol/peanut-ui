'use client'

import { Content, List, Root, Trigger } from '@radix-ui/react-tabs'
import { type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'
import { PILL_TINT_SELECTED_CHIP, PILL_TRACK_INVERTED } from './PillSurface'

/**
 * The ONE tab component for product and marketing. One look, no variants
 * (TASK-22707 — it absorbed the old `SegmentedControl`).
 *
 * The look is the app's own bottom navigation standing still (kush, 2026-09-21,
 * superseding the type-only "Weight" ruling): a bordered pill track carrying a
 * bordered chip, in polarity B — WHITE track, PAGE-TINT chip. The resting
 * surface is shared with `Global/BottomNav` through `PillSurface`, so the two
 * can never drift. Everything that makes the nav a nav — the `shadow-4` plane,
 * the spring, the sliding thumb, the 68x52 icon slot — is nav-only and stays
 * there. This row is static: no shadow, no slide, no spring.
 *
 * FLUSH, not inset (kush: "there should be no padding between the active pill
 * and the main container"). The track has NO padding, and the chip is NOT the
 * trigger's own border box — it is a `::before` pinned at `-inset-px`, the
 * model `BottomNav` uses for its thumb (`absolute -top-px -bottom-px`). That
 * draws the chip 1px outside the trigger on all four sides, so its border lands
 * ON TOP of the track's border and the two read as one complete outline instead
 * of a chip floating in a box. 1px, not 2px, because the track's border is 1px.
 *
 * The border therefore lives on a WRAPPER, not on the scrolling List: a scroll
 * container clips at its PADDING box, so it can never let a child paint over
 * its own border — with border and scroll on one element the chip's overhang
 * was trimmed away and the two curves read as a crescent gap at the rounded
 * ends. The List sits inside that wrapper and takes a 1px gutter (`-m-px
 * p-px`): its padding ring lands exactly over the track's border, so the chip's
 * overhang renders INSIDE the scrollport — over the border line — instead of
 * being clipped. And because padding is inside the scroll box, the gutter adds
 * zero scrollable overflow, which is what keeps the phantom-1px-scroll fix
 * (`scrollWidth === clientWidth` at rest) alive with the weld restored.
 *
 * Why a pseudo-element and not a negative margin: a negative margin would make
 * every trigger overlap its neighbour by 2px and would spend a point of the
 * `offScaleSpacing` ratchet. The chip is decoration that must escape the flow
 * box, which is what an out-of-flow box is for. The label then needs `z-10` to
 * sit above it — same reason `BottomNav` lifts its icons.
 *
 * The two fills are 1.09:1 apart (background-default vs background-page), so
 * the FILL CANNOT CARRY SELECTION on its own. The chip's 1px `border-default`
 * outline does that (18.09:1 on white, 16.60:1 on the tint), with the label
 * colour as the second channel and the label WEIGHT as the third (kush,
 * 2026-09-21): active steps 500 -> 600. That question was open while the row
 * shipped on border plus colour alone; the ruling took the weight because at a
 * 1.09:1 fill it costs nothing — the type token already exists and the glyph
 * metrics are identical at 16px. Never let a future change drop the chip border
 * and lean on fill.
 *
 * Radix headless base, semantic tokens only.
 */

interface TabDef {
    value: string
    /** widened to ReactNode with TASK-22452 so a tab can carry an icon
     *  beside its name (the network tabs) — string labels stay valid */
    label: ReactNode
    /** omit on EVERY tab for a triggers-only row — a value toggle whose
     *  switched content is rendered elsewhere on the screen */
    content?: ReactNode
}

interface TabsProps {
    tabs: TabDef[]
    'aria-label': string
    /**
     * Keep inactive panels mounted (hidden) instead of unmounting them. Needed
     * on marketing pages: tab prose must stay in the server HTML for crawlers.
     */
    forceMount?: boolean
    /** controlled mode (TASK-22452): pass value + onValueChange together;
     *  omit both and the first tab is the uncontrolled default */
    value?: string
    onValueChange?: (value: string) => void
    /**
     * What the row does with the width it is given. Omit it — the default — and
     * the track is content-width (`w-max`), which is what every surface with a
     * fixed, known set of tabs wants.
     *
     * - `stretch` — the track fills the row AND every tab grows to an equal
     *   share of it. The old `fullWidth` boolean, unchanged.
     * - `track` — the track fills the row and the tabs keep their CONTENT
     *   width, spreading inside it. This is `BottomNav`'s own arrangement
     *   (`flex flex-1 … justify-between`, content-sized slots spread across a
     *   full-width bar), which is the consistent answer for a look whose whole
     *   brief is the bottom nav standing still.
     *
     * Reach for `stretch` whenever the row is meant to FILL its container —
     * it is what every product row does today (add-money network type, the
     * explorer filters, the token selector's network row). `track` exists for
     * a full-width bar whose slots must stay content-sized, the way the bottom
     * nav is built; no product surface asks for that yet. `track` was tried on
     * the token selector (kush, 2026-09-21) on the theory that `All` should not
     * get the same room as `⬡ ARB`, and reverted 2026-09-22: at the widths that
     * row really gets, content-sized chips read as three islands scattered in
     * an empty pill, which is worse than an over-wide `All`.
     *
     * An enum, not two booleans: both values fill the row and differ only in
     * whether the tabs stretch with it, so they are one question with two
     * answers and cannot be set in contradiction.
     */
    fullWidth?: 'stretch' | 'track'
    /**
     * Row scale. Changes ONLY height, horizontal padding, the text-token pair
     * (inactive / active-semibold) and the icon-to-label gap — the chip weld,
     * the track border, the radius, the ring, the scroll gutter and the panel
     * spacing are identical in all three.
     *
     * `sm` is a 36px row, UNDER the 44px touch minimum. It clears WCAG 2.5.8 AA
     * (24px) but misses 2.5.5 AAA and Apple's 44pt guidance. Accepted by kush
     * 2026-09-21 for dense control panels, pending a real-device test — do not
     * use it for a primary control.
     */
    size?: TabsSize
}

// the full DS ring (design.md law 8 — focus is ruled, never pink). radix
// Content has tabIndex=0, so panels get the same ring instead of an invisible
// focus stop. BottomNav's ring omits `z-10` and `outline-solid`; that
// divergence is left alone here and tracked as a follow-up.
const focusRing =
    'focus-visible:z-10 focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-action-focus'

// Triggers scroll inside the track (see the List comment), so an outer ring
// would be cut by the clip box. The trigger's ring draws INSIDE its box
// instead — same 3px, same color, inset geometry. A ruled deviation from the
// outer-ring recipe (kush, 2026-09-21), taken over losing the stationary
// track. Panels keep the outer ring: they are not inside a scroll box.
const triggerRing = `${focusRing} focus-visible:outline-offset-[-3px]`

// The List is the scroll box INSIDE the track wrapper (kush, 2026-09-21: when
// a row overflows, "only internal items should scroll" — with the old outer
// scroll wrapper the whole bordered pill scrolled, and a rounded end sliding
// out of view read as a broken, cut-off box). The border, radius and fill sit
// on the wrapper and never move; the chips slide inside the List and clip
// against its own `rounded-full` curve, which coincides with the track's.
//
// `-m-px p-px` is the weld gutter: it pulls the List's box 1px outward on all
// sides so its PADDING ring sits exactly over the track's 1px border. A scroll
// container clips at its padding box, so the chip's 1px overhang renders inside
// that padding — on the border line — instead of being trimmed. Padding is
// inside the scroll box, so this adds no scrollable overflow.
//
// `overflow-y-hidden` is written out because `overflow-x: auto` forces a
// `visible` y to `auto` on its own, and the chip's 1px vertical overhang then
// made that y axis scrollable — the row scrolled on both axes with nothing to
// scroll. (`clip` cannot pair with `auto`; it would compute back to `hidden`.)
//
// `isolate` is the lid on this row's z-indices. Every `z-10` inside it is
// INTERNAL — the label lifting above the chip `::before`, the focus ring
// lifting above the neighbouring trigger — and none is meant to compete with
// page chrome. Without a stacking context of its own they escaped into the
// nearest one and tied with whatever else sat at `z-10` there, and a tie is
// settled by DOM order: in `TokenSelector` the row comes after the sticky
// `z-10` search field, so it won and painted the chips straight over the
// field's placeholder as soon as the token list scrolled under it. Isolating
// the List contains all of them, and because the List is itself unpositioned
// it stays under any positioned page chrome. The fix belongs here, not on the
// one caller: raising that caller to `z-20` would leave the primitive able to
// climb over the next piece of chrome it meets.
const listBox = 'isolate flex items-stretch gap-0 overflow-x-auto overflow-y-hidden rounded-full -m-px p-px'

// the trigger is a plain flow box; the chip rides 1px outside it as `::before`.
// The transparent resting border keeps the chip's geometry identical in both
// states, so switching tabs never shifts anything. Everything here is
// size-independent; the size-varying properties live in SIZES.
const trigger =
    'relative flex shrink-0 items-center justify-center whitespace-nowrap text-foreground-secondary transition-colors duration-instant active:text-action-ghost-hover data-[state=active]:z-10 data-[state=active]:text-foreground-primary'

/**
 * `lg` deliberately lands on BottomNav's own 52px / px-6, so a large tab row
 * and the nav read as one family. Heights are min-h-*, which the spacing
 * ratchet does not govern; the padding and gap steps are all on the documented
 * scale (3 / 4 / 6 and 1 / 2).
 *
 * Each size carries a PAIR of type tokens, not one token plus a weight class.
 * `text-body-m` is 500 and `text-body-m-semibold` is 600 at the same 1rem/1.25rem
 * metrics, so the step is a token swap with no reflow — and the `ds-lint`
 * `fontWeightOnTypeToken` ratchet stays at zero here, which stacking a raw
 * `font-semibold` on a type token would not. The two selectors are mutually
 * exclusive: radix gives a trigger `data-state="active"` or `"inactive"` and
 * never neither, so every trigger resolves exactly one of the pair.
 */
const SIZES = {
    sm: {
        row: 'min-h-9 px-3 data-[state=inactive]:text-body-s data-[state=active]:text-body-s-semibold',
        gap: 'gap-1',
    },
    md: {
        row: 'min-h-11 px-4 data-[state=inactive]:text-body-m data-[state=active]:text-body-m-semibold',
        gap: 'gap-1',
    },
    lg: {
        row: 'min-h-13 px-6 data-[state=inactive]:text-body-m data-[state=active]:text-body-m-semibold',
        gap: 'gap-2',
    },
} as const

type TabsSize = keyof typeof SIZES

const chip = 'before:absolute before:-inset-px before:rounded-full before:border before:border-transparent'

export const Tabs = ({
    tabs,
    'aria-label': ariaLabel,
    forceMount,
    value,
    onValueChange,
    fullWidth,
    size = 'md',
}: TabsProps) => {
    // no tab carries a panel → render the trigger row alone. A bordered empty
    // panel under a value toggle is the reason this branch exists.
    const hasPanels = tabs.some((tab) => tab.content !== undefined)

    return (
        // radix ignores defaultValue when value is set but warns on both — pass
        // exactly one
        <Root
            value={value}
            onValueChange={onValueChange}
            defaultValue={value === undefined ? tabs[0]?.value : undefined}
            className={fullWidth ? 'w-full' : undefined}
        >
            {/* the stationary track: border, radius and fill only. It is NOT a
                scroll container, so the chips inside may paint over its border.
                default: it hugs its content, capped at the row — past the cap
                the chips scroll inside it. fullWidth: the box is the row,
                fixed; overflowing chips scroll the same way, because the
                triggers are `shrink-0` and the List's `scrollWidth` sees them
                directly. */}
            <div className={twMerge(PILL_TRACK_INVERTED, fullWidth ? 'w-full' : 'w-max max-w-full')}>
                <List
                    aria-label={ariaLabel}
                    className={twMerge(
                        // gap-0 and no padding of its own: the chips meet the
                        // track edge. The 1px it does carry is the weld gutter.
                        listBox,
                        // Content-sized tabs spread across a full-width track.
                        //
                        // `between` and not `around`/`evenly`: it is what
                        // BottomNav does, and it is the only one that keeps the
                        // FIRST and LAST chip against the track's rounded ends,
                        // where the flush weld lives. Any other value insets
                        // them and the end chip floats inside the pill instead
                        // of completing its outline.
                        fullWidth === 'track' && 'justify-between'
                    )}
                >
                    {tabs.map((tab) => (
                        <Trigger
                            key={tab.value}
                            value={tab.value}
                            className={twMerge(
                                trigger,
                                SIZES[size].row,
                                chip,
                                PILL_TINT_SELECTED_CHIP,
                                triggerRing,
                                fullWidth === 'stretch' && 'flex-1'
                            )}
                        >
                            {/* above the chip, the way BottomNav lifts its icons */}
                            <span className={twMerge('relative z-10 flex items-center', SIZES[size].gap)}>
                                {tab.label}
                            </span>
                        </Trigger>
                    ))}
                </List>
            </div>
            {hasPanels &&
                tabs.map((tab) => (
                    <Content
                        key={tab.value}
                        value={tab.value}
                        forceMount={forceMount || undefined}
                        // data-[state=inactive]:hidden is what hides a forceMount panel:
                        // radix computes its own hidden attribute from `forceMount ||
                        // isSelected`, so with forceMount on it never sets it and every
                        // panel would render stacked
                        className={twMerge(
                            'mt-4 rounded-sm border border-border-default bg-background-default p-4 data-[state=inactive]:hidden',
                            focusRing
                        )}
                    >
                        {tab.content}
                    </Content>
                ))}
        </Root>
    )
}
