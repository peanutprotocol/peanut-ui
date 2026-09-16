'use client'

import { Content, List, Root, Trigger } from '@radix-ui/react-tabs'
import { type ReactNode } from 'react'
import { twMerge } from '@/utils/tw'

/**
 * /dev/tabs-proposals draft variants — 4 candidate content-tab styles for the
 * one consolidated Tab component (product + marketing surfaces).
 *
 * Deliberately LOCAL to this proposal page: nothing here ships. The winning
 * variant gets promoted to 0_Bruddle (figma-first — see design.md) and this
 * directory is deleted.
 *
 * All variants: radix Tabs base (the ruled headless base), semantic tokens
 * only, min-h-11 (44px) triggers, 3px action-focus ring (law 8), ghost press
 * to action-ghost-hover (law 7).
 */

export interface TabDef {
    value: string
    label: string
    content: ReactNode
}

interface TabVariantProps {
    tabs: TabDef[]
    'aria-label': string
}

// the one focus treatment, shared by every variant (matches .btn in globals.css)
const focusRing =
    'focus-visible:z-10 focus-visible:outline-[3px] focus-visible:outline-solid focus-visible:outline-action-focus'

const panelClasses = 'pt-4 focus-visible:outline-none'

/** A — underline: active tab gets a 2px action-primary underline over the divider rule. overflow scrolls. */
export const UnderlineTabs = ({ tabs, 'aria-label': ariaLabel }: TabVariantProps) => (
    <Root defaultValue={tabs[0].value}>
        <List aria-label={ariaLabel} className="flex overflow-x-auto border-b border-border-default">
            {tabs.map((tab) => (
                <Trigger
                    key={tab.value}
                    value={tab.value}
                    className={twMerge(
                        '-mb-px min-h-11 shrink-0 border-b-2 border-transparent px-4 text-body-m whitespace-nowrap text-foreground-secondary transition-colors duration-instant active:text-action-ghost-hover data-[state=active]:border-action-primary data-[state=active]:text-foreground-primary',
                        focusRing
                    )}
                >
                    {tab.label}
                </Trigger>
            ))}
        </List>
        {tabs.map((tab) => (
            <Content key={tab.value} value={tab.value} className={panelClasses}>
                {tab.content}
            </Content>
        ))}
    </Root>
)

/** B — contained: active tab is a bordered card-top joined to a bordered panel. overflow scrolls. */
export const ContainedTabs = ({ tabs, 'aria-label': ariaLabel }: TabVariantProps) => (
    <Root defaultValue={tabs[0].value}>
        <List aria-label={ariaLabel} className="flex overflow-x-auto px-2">
            {tabs.map((tab) => (
                <Trigger
                    key={tab.value}
                    value={tab.value}
                    className={twMerge(
                        'relative min-h-11 shrink-0 rounded-t-sm border border-b-0 border-transparent px-4 text-body-m whitespace-nowrap text-foreground-secondary transition-colors duration-instant active:text-action-ghost-hover data-[state=active]:z-10 data-[state=active]:border-border-default data-[state=active]:bg-background-default data-[state=active]:text-foreground-primary',
                        focusRing
                    )}
                >
                    {tab.label}
                </Trigger>
            ))}
        </List>
        {tabs.map((tab) => (
            <Content
                key={tab.value}
                value={tab.value}
                className="-mt-px rounded-sm border border-border-default bg-background-default p-4 focus-visible:outline-none"
            >
                {tab.content}
            </Content>
        ))}
    </Root>
)

/** C — pills: SegmentedControl-adjacent look with full tab-panel semantics. overflow wraps. */
export const PillTabs = ({ tabs, 'aria-label': ariaLabel }: TabVariantProps) => (
    <Root defaultValue={tabs[0].value}>
        <List aria-label={ariaLabel} className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
                <Trigger
                    key={tab.value}
                    value={tab.value}
                    className={twMerge(
                        'min-h-11 rounded-round border border-border-default px-4 text-body-s whitespace-nowrap text-foreground-secondary transition-colors duration-instant active:border-action-primary data-[state=active]:border-action-primary data-[state=active]:bg-action-primary/10 data-[state=active]:text-action-primary',
                        focusRing
                    )}
                >
                    {tab.label}
                </Trigger>
            ))}
        </List>
        {tabs.map((tab) => (
            <Content key={tab.value} value={tab.value} className={panelClasses}>
                {tab.content}
            </Content>
        ))}
    </Root>
)

/** D — text: minimal labels over a divider rule; active is foreground-primary at semibold. overflow scrolls. */
export const TextTabs = ({ tabs, 'aria-label': ariaLabel }: TabVariantProps) => (
    <Root defaultValue={tabs[0].value}>
        <List aria-label={ariaLabel} className="flex gap-6 overflow-x-auto border-b border-border-default">
            {tabs.map((tab) => (
                <Trigger
                    key={tab.value}
                    value={tab.value}
                    // font-semibold on body-m reproduces the body-m-semibold token values
                    // (16/600) without stacking two type tokens in one class list
                    className={twMerge(
                        'min-h-11 shrink-0 text-body-m whitespace-nowrap text-foreground-secondary transition-colors duration-instant active:text-action-ghost-hover data-[state=active]:font-semibold data-[state=active]:text-foreground-primary',
                        focusRing
                    )}
                >
                    {tab.label}
                </Trigger>
            ))}
        </List>
        {tabs.map((tab) => (
            <Content key={tab.value} value={tab.value} className={panelClasses}>
                {tab.content}
            </Content>
        ))}
    </Root>
)
