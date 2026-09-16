'use client'

import { Tabs } from '@/components/0_Bruddle/Tabs'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { DocHeader } from '../../_components/DocHeader'
import { DocSection } from '../../_components/DocSection'
import { SectionDivider } from '../../_components/SectionDivider'
import { DocPage } from '../../_components/DocPage'
import { PropsTable } from '../../_components/PropsTable'
import { CodeBlock } from '../../_components/CodeBlock'

const historyRows = [
    { icon: 'bank', title: 'Bank deposit', body: '12 Sep 2026', amount: '+$50.00' },
    { icon: 'credit-card', title: 'Card payment', body: '10 Sep 2026', amount: '-$12.40' },
] as const

export default function TabsPage() {
    return (
        <DocPage>
            <DocHeader
                title="Tabs"
                description="The one content-tab component for product and marketing — variant B (contained) from the tabs proposals, ruled 2026-09-16. Active tab is a bordered card-top joined to the panel. Code-first, figma board pending. Consumer: Marketing/mdx/Tabs."
                status="production"
            />

            <DocSection title="Content tabs">
                <DocSection.Content>
                    <Tabs
                        aria-label="Transaction"
                        tabs={[
                            {
                                value: 'details',
                                label: 'Details',
                                content: (
                                    <div className="flex flex-col divide-y divide-dashed divide-border-default">
                                        <DataRow label="Created" value="12 Sep 2026" />
                                        <DataRow label="Fee" value="$0.10" />
                                        <DataRow label="Total" value="$50.10" />
                                    </div>
                                ),
                            },
                            {
                                value: 'history',
                                label: 'History',
                                content: (
                                    <div className="flex flex-col">
                                        {historyRows.map((row, index) => (
                                            <ListItem
                                                key={row.title}
                                                position={getCardPosition(index, historyRows.length)}
                                                leading={<IconBubble icon={row.icon} />}
                                                title={row.title}
                                                body={row.body}
                                                trailing={
                                                    <span className="text-body-m-semibold text-foreground-primary">
                                                        {row.amount}
                                                    </span>
                                                }
                                            />
                                        ))}
                                    </div>
                                ),
                            },
                            {
                                value: 'notes',
                                label: 'Notes',
                                content: (
                                    <p className="text-body-s text-foreground-secondary">
                                        Any content goes in a panel — rows, cards, or prose.
                                    </p>
                                ),
                            },
                        ]}
                    />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Tabs"
                        code={`import { Tabs } from '@/components/0_Bruddle/Tabs'

<Tabs
    aria-label="Transaction"
    tabs={[
        { value: 'details', label: 'Details', content: <DetailsPanel /> },
        { value: 'history', label: 'History', content: <HistoryPanel /> },
    ]}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection
                title="Overflow"
                description="More tabs than the phone is wide: the trigger row scrolls, the focus ring is not clipped, the panel stays put."
            >
                <DocSection.Content>
                    <Tabs
                        aria-label="Currencies"
                        tabs={['Argentina', 'Brazil', 'Colombia', 'Mexico', 'Peru'].map((label) => ({
                            value: label,
                            label,
                            content: <p className="text-body-s text-foreground-secondary">{label} panel.</p>,
                        }))}
                    />
                </DocSection.Content>
            </DocSection>

            <SectionDivider />

            <PropsTable
                rows={[
                    {
                        name: 'tabs',
                        type: '{ value, label, content }[]',
                        default: '—',
                        description: 'Trigger labels and their panels, in order. First tab is active',
                    },
                    {
                        name: 'aria-label',
                        type: 'string',
                        default: '—',
                        description: 'Required — names the tab list for screen readers',
                    },
                    {
                        name: 'forceMount',
                        type: 'boolean',
                        default: 'false',
                        description: 'Keep inactive panels in the DOM (hidden) — marketing prose needs it for crawlers',
                    },
                ]}
            />
        </DocPage>
    )
}
