'use client'

import { Content, List, Root, Trigger } from '@radix-ui/react-tabs'
import { type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'
import {
    TAB_FOCUS_RING,
    TAB_FORCED_RING,
    TAB_LOOKS,
    TAB_SCROLL_WRAP,
    TAB_TRIGGER_BASE,
    type TabsLook,
} from '@/components/0_Bruddle/TabsLook'

/**
 * /dev/tabs-proposals draft looks — 6 candidate skins for the ONE `0_Bruddle/Tabs`
 * component (TASK-22707, which deletes `SegmentedControl`).
 *
 * The abstract demos on this page. The look classes themselves live in
 * `0_Bruddle/TabsLook`, because `/dev/tabs-proposals/surfaces` re-skins REAL
 * screens with the same maps through a context — one definition, two pages.
 *
 * Nothing here ships. `Tabs` and `SegmentedControl` fall back to their own
 * styles whenever no look provider is above them, which is every real screen.
 * The winning look is written into `Tabs` in a separate PR and this directory
 * and `TabsLook` are deleted then.
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

/** the look keys, the class maps and the shared bases live with the components
 *  they re-skin, so `Tabs` / `SegmentedControl` and this page share ONE definition */
export type VariantKey = TabsLook

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
    const style = TAB_LOOKS[variant]
    const hasPanels = tabs.some((tab) => tab.content !== undefined)

    return (
        <Root defaultValue={tabs[0]?.value} className={twMerge(fullWidth && 'w-full')}>
            <div className={TAB_SCROLL_WRAP}>
                <List
                    aria-label={ariaLabel}
                    className={twMerge('flex w-max min-w-full items-stretch', style.list, fullWidth && 'w-full')}
                >
                    {tabs.map((tab, index) => (
                        <Trigger
                            key={tab.value}
                            value={tab.value}
                            className={twMerge(
                                TAB_TRIGGER_BASE,
                                style.trigger,
                                TAB_FOCUS_RING,
                                fullWidth && 'flex-1',
                                index === forceFocusIndex && TAB_FORCED_RING
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
                        className={twMerge('pt-4 data-[state=inactive]:hidden', TAB_FOCUS_RING)}
                    >
                        {tab.content}
                    </Content>
                ))}
        </Root>
    )
}
