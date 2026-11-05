'use client'

import { Content, List, Root, Trigger } from '@radix-ui/react-tabs'
import { type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'
import { CARD_SURFACE } from './Card'

/**
 * The ONE tab component for product and marketing. One look, no variants
 * (TASK-22707). Since PR 3619 that look is the receipt tabs: a page-tint strip,
 * the active tab a bordered `background-tab-active` box, joined flush to a
 * white bordered panel. Selection is carried by the border, the fill and the
 * label weight together. Radix headless base, semantic tokens only.
 */

interface TabDef {
    value: string
    /** widened to ReactNode with TASK-22452 so a tab can carry an icon
     *  beside its name (the network tabs) — string labels stay valid */
    label: ReactNode
    /** omit on EVERY tab for a triggers-only row — a value toggle whose
     *  switched content is rendered elsewhere on the screen */
    content?: ReactNode
    /** a tab that cannot be picked right now: radix skips it in the arrow-key
     *  order and ignores its taps. The caller says why next to the row. */
    disabled?: boolean
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
// Content has tabIndex=0, so panels get the same ring.
const focusRing =
    'focus-visible:z-10 focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-action-focus'

// triggers sit inside a scroll box, so their ring is drawn inset to avoid the clip
const triggerRing = `${focusRing} focus-visible:outline-offset-[-3px]`

// `isolate` keeps the active tab's z-10 inside the row (TokenSelector's sticky search sits at z-10)
const listBox = 'isolate flex items-stretch overflow-x-auto overflow-y-hidden'

// the transparent resting border keeps geometry identical in both states, so switching never shifts anything
const trigger =
    'relative flex min-w-max shrink-0 items-center justify-center whitespace-nowrap border border-transparent text-foreground-secondary transition-colors duration-instant data-[state=active]:z-10 data-[state=active]:border-border-default data-[state=active]:bg-background-tab-active data-[state=active]:text-foreground-primary disabled:cursor-not-allowed disabled:opacity-40'

/** each size swaps a type-token pair (500 → 600), so the weight step never reflows */
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

export const Tabs = ({
    tabs,
    'aria-label': ariaLabel,
    forceMount,
    value,
    onValueChange,
    fullWidth,
    size = 'md',
}: TabsProps) => {
    // no tab carries a panel → render the trigger row alone, with no empty panel under a value toggle
    const hasPanels = tabs.some((tab) => tab.content !== undefined)

    return (
        // radix ignores defaultValue when value is set but warns on both — pass exactly one
        <Root
            value={value}
            onValueChange={onValueChange}
            defaultValue={value === undefined ? tabs[0]?.value : undefined}
            className={fullWidth ? 'w-full' : undefined}
        >
            <List
                aria-label={ariaLabel}
                className={twMerge(
                    listBox,
                    'bg-background-page',
                    fullWidth ? 'w-full' : 'w-max max-w-full',
                    fullWidth === 'track' && 'justify-between'
                )}
            >
                {tabs.map((tab) => (
                    <Trigger
                        key={tab.value}
                        value={tab.value}
                        disabled={tab.disabled}
                        className={twMerge(
                            trigger,
                            hasPanels ? 'rounded-t-sm' : 'rounded-sm',
                            SIZES[size].row,
                            triggerRing,
                            fullWidth === 'stretch' && 'flex-1'
                        )}
                    >
                        <span className={twMerge('flex items-center', SIZES[size].gap)}>{tab.label}</span>
                    </Trigger>
                ))}
            </List>
            {hasPanels &&
                tabs.map((tab) => (
                    <Content
                        key={tab.value}
                        value={tab.value}
                        forceMount={forceMount || undefined}
                        // radix never sets `hidden` on a forceMount panel, so inactive ones hide by state
                        className={twMerge(`-mt-px ${CARD_SURFACE} p-4 data-[state=inactive]:hidden`, focusRing)}
                    >
                        {tab.content}
                    </Content>
                ))}
        </Root>
    )
}
