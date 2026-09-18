'use client'

import { Content, List, Root, Trigger } from '@radix-ui/react-tabs'
import { type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'

/**
 * /dev/tabs-proposals draft looks — 6 candidate skins for the ONE `0_Bruddle/Tabs`
 * component (TASK-22707, which deletes `SegmentedControl`).
 *
 * Deliberately LOCAL to this proposal page: nothing here ships and the real
 * `0_Bruddle/Tabs` is untouched. The winning look is applied to that component
 * in a separate PR and this directory is deleted.
 *
 * The hard constraint every look must satisfy is that the SAME skin has to read
 * as finished in two modes:
 *   - panelled  — triggers above a content panel (TokenSelector, Marketing/mdx/Tabs)
 *   - standalone — triggers alone, content switched elsewhere (7 of 10 call sites)
 * so NO look here welds the trigger row to the panel. The shipped `card` look
 * does, which is why it reads as broken floating alone.
 *
 * Shared by all six: radix Tabs (the ruled headless base), semantic tokens only,
 * 44px triggers (law 3), the 3px `action-focus` ring (law 8), ghost press to
 * `action-ghost-hover` (law 7), `duration-instant` color transitions, and a
 * horizontal scroll wrapper whose 4px gutter keeps the ring from clipping.
 */

export interface TabDef {
    value: string
    /** ReactNode so a tab can carry an icon beside its name (TokenSelector) */
    label: ReactNode
    /** optional — give NO tab a content and only the trigger row renders */
    content?: ReactNode
}

export type VariantKey = 'rule' | 'awning' | 'blush' | 'frame' | 'weight' | 'track'

interface VariantStyle {
    list: string
    trigger: string
}

// the one focus treatment (matches .btn in globals.css). #3251's pill had none.
const FOCUS_RING =
    'focus-visible:z-10 focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-action-focus'

// the same ring, drawn unconditionally, so a screenshot can show state (e) —
// :focus-visible cannot be forced from CSS. Demo-only, never in a shipped skin.
const FORCED_RING = 'z-10 outline-[3px] outline-solid outline-action-focus'

// every trigger, whatever the skin
const TRIGGER_BASE =
    'relative flex min-h-11 shrink-0 items-center justify-center gap-1 whitespace-nowrap transition-colors duration-instant'

// the ring must not clip at the scroll edges, so the wrapper owns overflow with
// a 4px inner gutter (>=3px ring) and a negative margin to keep the layout
const SCROLL_WRAP = '-m-1 overflow-x-auto p-1'

const VARIANTS: Record<VariantKey, VariantStyle> = {
    /**
     * Rule — the row sits on a full-width 1px rule; the active tab thickens it
     * to 2px under its own label. No fill anywhere.
     * selected token: `border-border-default` + `text-foreground-primary`.
     */
    rule: {
        list: 'border-b border-border-default',
        trigger:
            'border-b-2 border-transparent px-4 text-body-m text-foreground-secondary active:text-action-ghost-hover data-[state=active]:border-border-default data-[state=active]:text-foreground-primary',
    },

    /**
     * Awning — the affordance sits on TOP: the active tab wears a 2px brand cap
     * over a white fill, so the row reads as a set of cards standing up.
     * selected token: `border-action-primary` cap + `bg-background-default`.
     */
    awning: {
        list: 'gap-1',
        trigger:
            'rounded-b-sm border-t-2 border-transparent px-4 text-body-m text-foreground-secondary active:text-action-ghost-hover data-[state=active]:border-action-primary data-[state=active]:bg-background-default data-[state=active]:text-foreground-primary',
    },

    /**
     * Blush — the active tab is a solid brand block. The loudest option, and the
     * one that ratifies `action-primary` as THE selected surface app-wide
     * (which is what ui#3232 already did to NetworkListItem).
     * selected token: `bg-action-primary` + `text-foreground-over-color-primary`.
     */
    blush: {
        list: 'gap-2',
        trigger:
            'rounded-sm px-4 text-body-m text-foreground-secondary active:text-action-ghost-hover data-[state=active]:bg-action-primary data-[state=active]:text-foreground-over-color-primary',
    },

    /**
     * Frame — the active tab is a bordered white box, the shipped `card` look
     * with the weld cut off. Same geometry panelled and standalone.
     * selected token: `border-border-default` + `bg-background-default`.
     */
    frame: {
        list: 'gap-2',
        trigger:
            'rounded-sm border border-transparent px-4 text-body-m text-foreground-secondary active:text-action-ghost-hover data-[state=active]:border-border-default data-[state=active]:bg-background-default data-[state=active]:text-foreground-primary',
    },

    /**
     * Weight — type only: no rule, no border, no fill. The active label goes
     * black and semibold, the rest stay secondary.
     * The two states carry two DIFFERENT type tokens rather than one token plus
     * a font-weight utility — a type token owns its own weight (design.md type
     * rules), and the states are mutually exclusive so nothing stacks.
     * selected token: `text-foreground-primary` + body-m-semibold. Nothing else.
     */
    weight: {
        list: 'gap-6',
        trigger:
            'px-0 text-foreground-secondary active:text-action-ghost-hover data-[state=inactive]:text-body-m data-[state=active]:text-body-m-semibold data-[state=active]:text-foreground-primary',
    },

    /**
     * Track — the row is a recessed container and the active tab is a card
     * raised out of it. The only look here that needs a surface the DS does not
     * have: `background-page` is the PAGE tint, borrowed as a track.
     * selected token: `bg-background-default` + `border-border-default`,
     * on a track that wants a NEW `--color-background-track`.
     */
    track: {
        list: 'gap-0.5 rounded-sm bg-background-page p-0.5',
        trigger:
            'rounded-sm border border-transparent px-4 text-body-m text-foreground-secondary active:text-action-ghost-hover data-[state=active]:border-border-default data-[state=active]:bg-background-default data-[state=active]:text-foreground-primary',
    },
}

interface ProposalTabsProps {
    variant: VariantKey
    tabs: TabDef[]
    'aria-label': string
    /** stretch triggers to equal widths filling the row (FilterPanel, share-builder) */
    fullWidth?: boolean
    /** keep inactive panels in the DOM for crawlers (marketing) */
    forceMount?: boolean
    /** demo only: draw the keyboard focus ring on this trigger index */
    forceFocusIndex?: number
}

/**
 * One implementation, six skins. The radix wiring, the a11y, the overflow
 * scroller and the focus ring are identical across the proposals on purpose —
 * only the class strings above differ, so the page compares looks and nothing else.
 */
export const ProposalTabs = ({
    variant,
    tabs,
    'aria-label': ariaLabel,
    fullWidth,
    forceMount,
    forceFocusIndex,
}: ProposalTabsProps) => {
    const style = VARIANTS[variant]
    const hasPanels = tabs.some((tab) => tab.content !== undefined)

    return (
        <Root defaultValue={tabs[0]?.value} className={twMerge(fullWidth && 'w-full')}>
            <div className={SCROLL_WRAP}>
                <List
                    aria-label={ariaLabel}
                    className={twMerge('flex w-max min-w-full items-stretch', style.list, fullWidth && 'w-full')}
                >
                    {tabs.map((tab, index) => (
                        <Trigger
                            key={tab.value}
                            value={tab.value}
                            className={twMerge(
                                TRIGGER_BASE,
                                style.trigger,
                                FOCUS_RING,
                                fullWidth && 'flex-1',
                                index === forceFocusIndex && FORCED_RING
                            )}
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
                        // data-[state=inactive]:hidden is what hides a forceMount
                        // panel: radix computes its own hidden attribute from
                        // `forceMount || isSelected`, so with forceMount on it
                        // never sets it and every panel would render stacked
                        className={twMerge('pt-4 data-[state=inactive]:hidden', FOCUS_RING)}
                    >
                        {tab.content}
                    </Content>
                ))}
        </Root>
    )
}
