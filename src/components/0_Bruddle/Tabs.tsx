'use client'

import { Content, List, Root, Trigger } from '@radix-ui/react-tabs'
import { type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'

/**
 * The one tab component for product and marketing. Two shapes, one primitive
 * (TASK-22707 — it absorbed the old `SegmentedControl`):
 *
 * - `variant="card"` (default) — content tabs. Variant B ("contained") from the
 *   tabs proposals page, ruled by kush 2026-09-16. The active tab is a bordered
 *   card-top joined to the bordered panel below it.
 * - `variant="pill"` — a value toggle (period, network, view mode). Compact pill
 *   row, the active segment gets the action-primary border + tint. Its switched
 *   content usually lives elsewhere in the layout, so give no tab a `content`
 *   and the component renders the trigger row alone.
 *
 * Radix headless base, semantic tokens only.
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
    /** 'card' = content tabs joined to a panel; 'pill' = value toggle */
    variant?: 'card' | 'pill'
    /** pill only: stretch the segments to fill the row (network toggles) */
    fullWidth?: boolean
}

// the one focus treatment (matches .btn in globals.css). radix Content has
// tabIndex=0, so panels get the same ring instead of an invisible focus stop.
const focusRing =
    'focus-visible:z-10 focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-action-focus'

// the ring must not clip at the scroll edges, so the wrapper owns overflow with
// a 4px inner gutter (>=3px ring) and a negative margin to keep the layout; the
// list spans the scrolled width (w-max min-w-full).
const scrollWrap = '-m-1 overflow-x-auto p-1'

const cardTrigger =
    'relative min-h-11 shrink-0 rounded-t-sm border border-b-0 border-transparent px-4 text-body-m whitespace-nowrap text-foreground-secondary transition-colors duration-instant active:text-action-ghost-hover data-[state=active]:z-10 data-[state=active]:border-border-default data-[state=active]:bg-background-default data-[state=active]:text-foreground-primary'

const pillTrigger =
    'rounded-sm border border-transparent px-3 py-1.5 text-label-m text-foreground-secondary transition-all duration-fast data-[state=active]:border-action-primary data-[state=active]:bg-action-primary/10 data-[state=active]:text-action-primary'

export const Tabs = ({
    tabs,
    'aria-label': ariaLabel,
    forceMount,
    value,
    onValueChange,
    variant = 'card',
    fullWidth = false,
}: TabsProps) => {
    const isPill = variant === 'pill'
    // no tab carries a panel → render the trigger row alone. A bordered empty
    // panel under a value toggle is the reason this branch exists.
    const hasPanels = tabs.some((tab) => tab.content !== undefined)

    const triggers = tabs.map((tab) => (
        <Trigger
            key={tab.value}
            value={tab.value}
            className={twMerge(isPill ? pillTrigger : twMerge(cardTrigger, focusRing), isPill && fullWidth && 'flex-1')}
        >
            {tab.label}
        </Trigger>
    ))

    return (
        // radix ignores defaultValue when value is set but warns on both — pass
        // exactly one
        <Root
            value={value}
            onValueChange={onValueChange}
            defaultValue={value === undefined ? tabs[0]?.value : undefined}
            className={isPill && fullWidth ? 'w-full' : undefined}
        >
            {isPill ? (
                <List
                    aria-label={ariaLabel}
                    className={twMerge('flex items-center rounded-sm p-0', fullWidth && 'w-full')}
                >
                    {triggers}
                </List>
            ) : (
                <div className={scrollWrap}>
                    <List aria-label={ariaLabel} className="flex w-max min-w-full px-2">
                        {triggers}
                    </List>
                </div>
            )}
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
                            '-mt-px rounded-sm border border-border-default bg-background-default p-4 data-[state=inactive]:hidden',
                            focusRing
                        )}
                    >
                        {tab.content}
                    </Content>
                ))}
        </Root>
    )
}
