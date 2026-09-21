'use client'

import { Content, List, Root, Trigger } from '@radix-ui/react-tabs'
import { type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'

/**
 * The ONE tab component for product and marketing. One look, no variants
 * (TASK-22707 — it absorbed the old `SegmentedControl`, and kush ruled the
 * "Weight" look on 2026-09-18 after the six-look proposals page).
 *
 * Weight is type only: no rule, no border, no fill anywhere on the trigger row.
 * The active label carries the strong foreground token at semibold, the rest
 * stay secondary. The two states carry two DIFFERENT type tokens rather than
 * one token plus a `font-semibold` utility — a type token owns its own weight
 * (ds-lint `fontWeightOnTypeToken`), and the states are mutually exclusive so
 * nothing stacks.
 *
 * Because there is no fill, this look says NOTHING about how a selected list
 * row should look. The app-wide selected-surface question is still open — see
 * ui#3232's pink NetworkListItem.
 *
 * Radix headless base, semantic tokens only.
 * code-first per the owner ruling 2026-09-16 — figma board pending.
 *
 * API is a `tabs` array, not an Accordion-style compound: both consumers hand
 * over a flat list of labelled panels anyway (the MDX adapter derives it from
 * <TabPanel> children, product screens from data), and keeping the List and the
 * Contents as exact siblings in one order is the component's job, not every
 * caller's.
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
    /** stretch the tabs to fill the row (network toggles) */
    fullWidth?: boolean
    /**
     * Which foreground pair the labels use. Same look either way — this swaps
     * the two TEXT COLOUR tokens and nothing else, so a row on a brand fill
     * stays readable. `on-color` exists because `foreground-secondary` is
     * 3.85:1 on `yellow-500` (under AA); `foreground-over-color-secondary` is
     * 5.02:1 there.
     */
    tone?: 'default' | 'on-color'
}

// the one focus treatment (matches .btn in globals.css). radix Content has
// tabIndex=0, so panels get the same ring instead of an invisible focus stop.
// The old pill had no ring at all; Weight has no border to lean on either, so
// this is the only thing that marks keyboard focus.
const focusRing =
    'focus-visible:z-10 focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-action-focus'

// the ring must not clip at the scroll edges, so the wrapper owns overflow with
// a 4px inner gutter (>=3px ring) and a negative margin to keep the layout.
const scrollWrap = '-m-1 overflow-x-auto p-1'

// shape + type. The two type tokens sit across mutually exclusive data-state
// selectors so a type token never stacks with a font-weight utility (ds-lint
// `fontWeightOnTypeToken`).
const trigger =
    'relative flex min-h-11 shrink-0 items-center justify-center gap-1 px-0 whitespace-nowrap transition-colors duration-instant active:text-action-ghost-hover data-[state=inactive]:text-body-m data-[state=active]:text-body-m-semibold'

// the ONLY thing `tone` changes: which foreground pair the labels use.
const toneClasses = {
    default: 'text-foreground-secondary data-[state=active]:text-foreground-primary',
    'on-color': 'text-foreground-over-color-secondary data-[state=active]:text-foreground-over-color-primary',
} as const

export const Tabs = ({
    tabs,
    'aria-label': ariaLabel,
    forceMount,
    value,
    onValueChange,
    fullWidth = false,
    tone = 'default',
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
            <div className={scrollWrap}>
                <List
                    aria-label={ariaLabel}
                    className={twMerge('flex items-stretch gap-6', fullWidth ? 'w-full' : 'w-max min-w-full')}
                >
                    {tabs.map((tab) => (
                        <Trigger
                            key={tab.value}
                            value={tab.value}
                            className={twMerge(trigger, toneClasses[tone], focusRing, fullWidth && 'flex-1')}
                        >
                            {tab.label}
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
                        // panel would render stacked.
                        // mt-4, not the old -mt-px weld: Weight draws no card-top, so
                        // the panel stands on its own with a normal gap above it.
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
