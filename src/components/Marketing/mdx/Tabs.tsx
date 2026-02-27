'use client'

import * as RadixTabs from '@radix-ui/react-tabs'
import { type ReactNode } from 'react'
import { PROSE_WIDTH } from './constants'

interface TabsProps {
    /** Comma-separated tab labels, e.g. "Peanut,Wise,Western Union" */
    labels: string
    children: ReactNode
}

interface TabPanelProps {
    /** Must match one of the labels exactly */
    label: string
    children: ReactNode
}

const triggerClasses =
    'flex-1 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-grey-1 transition-all data-[state=active]:border-primary-1 data-[state=active]:bg-primary-1/10 data-[state=active]:text-primary-1'

/**
 * Tabbed content for MDX pages.
 *
 * Usage:
 * ```mdx
 * <Tabs labels="Peanut,Wise,Western Union">
 *   <TabPanel label="Peanut">
 *     Content about Peanut...
 *   </TabPanel>
 *   <TabPanel label="Wise">
 *     Content about Wise...
 *   </TabPanel>
 *   <TabPanel label="Western Union">
 *     Content about Western Union...
 *   </TabPanel>
 * </Tabs>
 * ```
 */
export function Tabs({ labels, children }: TabsProps) {
    const tabs = labels.split(',').map((l) => l.trim())
    return (
        <div className={`mx-auto my-8 ${PROSE_WIDTH} px-6 md:px-4`}>
            <RadixTabs.Root defaultValue={tabs[0]} className="w-full">
                <RadixTabs.List
                    className="flex w-full items-center rounded-xl bg-white p-1 shadow-sm ring-1 ring-n-1/10"
                    aria-label="Content tabs"
                >
                    {tabs.map((tab) => (
                        <RadixTabs.Trigger key={tab} value={tab} className={triggerClasses}>
                            {tab}
                        </RadixTabs.Trigger>
                    ))}
                </RadixTabs.List>
                {children}
            </RadixTabs.Root>
        </div>
    )
}

export function TabPanel({ label, children }: TabPanelProps) {
    return (
        <RadixTabs.Content
            value={label}
            forceMount
            className="mt-4 text-base leading-[1.75] text-grey-1 data-[state=inactive]:hidden"
        >
            {children}
        </RadixTabs.Content>
    )
}
