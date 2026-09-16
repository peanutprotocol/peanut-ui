'use client'

import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Tabs as DsTabs } from '@/components/0_Bruddle/Tabs'
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

/**
 * Tabbed content for MDX pages — a thin adapter over the DS `Tabs` primitive
 * (`0_Bruddle/Tabs`). MDX cannot pass an array prop, so this keeps the
 * `labels` + `<TabPanel>` authoring shape and folds it into the array the
 * primitive takes. `TabPanel` is a marker: the adapter reads its props, the
 * primitive renders the panels.
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
    const panels = new Map(
        Children.toArray(children)
            .filter((child): child is ReactElement<TabPanelProps> => isValidElement(child))
            .map((child) => [child.props.label, child.props.children])
    )
    const tabs = labels
        .split(',')
        .map((label) => label.trim())
        .map((label) => ({
            value: label,
            label,
            // -mx-4 cancels the panel's own horizontal padding: MDX prose already
            // carries the px-6 column gutter, and stacking both left ~30
            // characters per line at 375px
            content: <div className="-mx-4">{panels.get(label) ?? null}</div>,
        }))

    return (
        <div className={`mx-auto my-8 ${PROSE_WIDTH} px-6 md:px-4`}>
            {/* forceMount: every panel's prose has to stay in the server HTML for crawlers */}
            <DsTabs tabs={tabs} aria-label="Content tabs" forceMount />
        </div>
    )
}

export function TabPanel({ children }: TabPanelProps) {
    return <>{children}</>
}
