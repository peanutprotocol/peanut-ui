'use client'

import { Content, List, Root, Trigger } from '@radix-ui/react-tabs'
import { type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'
import { TAB_TRIGGER_BASE, useTabsLook } from './TabsLook'

/**
 * The one content-tab component for product and marketing — variant B
 * ("contained") from the tabs proposals page, ruled by kush 2026-09-16 (the
 * proposals page is deleted with this change). Active tab
 * is a bordered card-top joined to the bordered panel below it. Radix headless
 * base, semantic tokens only. SegmentedControl stays separate: that is a
 * value toggle (period, network), this is tabbed content with panels.
 *
 * code-first per the owner ruling 2026-09-16 — figma board pending (❓).
 *
 * API is a `tabs` array, not an Accordion-style compound: the joined
 * card-top→panel geometry depends on the List and the Contents being exact
 * siblings in one order, so the component owns that structure instead of
 * trusting every caller to rebuild it. Both consumers hand over a flat list of
 * labelled panels anyway (the MDX adapter derives it from <TabPanel> children,
 * product screens from data).
 */

interface TabDef {
    value: string
    /** widened to ReactNode with TASK-22452 so a tab can carry an icon
     *  beside its name (the network tabs) — string labels stay valid */
    label: ReactNode
    content: ReactNode
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
}

// the one focus treatment (matches .btn in globals.css). radix Content has
// tabIndex=0, so panels get the same ring instead of an invisible focus stop.
const focusRing =
    'focus-visible:z-10 focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-action-focus'

// the ring must not clip at the scroll edges, so the wrapper owns overflow with
// a 4px inner gutter (>=3px ring) and a negative margin to keep the layout; the
// list spans the scrolled width (w-max min-w-full).
const scrollWrap = '-m-1 overflow-x-auto p-1'

export const Tabs = ({ tabs, 'aria-label': ariaLabel, forceMount, value, onValueChange }: TabsProps) => {
    // null on every shipped screen; a /dev/tabs-proposals look otherwise (TASK-22707)
    const look = useTabsLook()

    return (
        // radix ignores defaultValue when value is set but warns on both — pass
        // exactly one
        <Root
            value={value}
            onValueChange={onValueChange}
            defaultValue={value === undefined ? tabs[0]?.value : undefined}
        >
            <div className={scrollWrap}>
                <List
                    aria-label={ariaLabel}
                    className={twMerge('flex w-max min-w-full px-2', look && `items-stretch px-0 ${look.list}`)}
                >
                    {tabs.map((tab) => (
                        <Trigger
                            key={tab.value}
                            value={tab.value}
                            className={twMerge(
                                look
                                    ? `${TAB_TRIGGER_BASE} ${look.trigger}`
                                    : 'relative min-h-11 shrink-0 rounded-t-sm border border-b-0 border-transparent px-4 text-body-m whitespace-nowrap text-foreground-secondary transition-colors duration-instant active:text-action-ghost-hover data-[state=active]:z-10 data-[state=active]:border-border-default data-[state=active]:bg-background-default data-[state=active]:text-foreground-primary',
                                focusRing
                            )}
                        >
                            {tab.label}
                        </Trigger>
                    ))}
                </List>
            </div>
            {tabs.map((tab) => (
                <Content
                    key={tab.value}
                    value={tab.value}
                    forceMount={forceMount || undefined}
                    // data-[state=inactive]:hidden is what hides a forceMount panel:
                    // radix computes its own hidden attribute from `forceMount ||
                    // isSelected`, so with forceMount on it never sets it and every
                    // panel would render stacked
                    className={twMerge(
                        '-mt-px rounded-sm border border-border-default bg-background-default p-4 data-[state=inactive]:hidden',
                        // no look welds its trigger row to the panel, so the panel
                        // stands on its own with a normal gap above it
                        look && 'mt-4',
                        focusRing
                    )}
                >
                    {tab.content}
                </Content>
            ))}
        </Root>
    )
}
