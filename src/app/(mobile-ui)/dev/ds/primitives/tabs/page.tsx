'use client'

import { useState } from 'react'
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
    const [period, setPeriod] = useState('monthly')
    const [network, setNetwork] = useState('evm')

    return (
        <DocPage>
            <DocHeader
                title="Tabs"
                description="The ONE tab component for product and marketing — one look, no variants. 'Weight' from the six-look proposals, ruled 2026-09-18 (TASK-22707, which also absorbed SegmentedControl). Type only: no rule, no border, no fill. The active label is the strong foreground token at semibold, the rest are secondary. Code-first, figma board pending."
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

            <DocSection
                title="Value toggles — no panel"
                description="Period, network and view-mode switches. Same look as content tabs; the only difference is that the switched content lives elsewhere on the screen, so no tab carries `content` and the component renders the trigger row alone. `fullWidth` stretches the tabs."
            >
                <DocSection.Content>
                    <div className="flex flex-col gap-4">
                        <Tabs
                            aria-label="Period"
                            value={period}
                            onValueChange={setPeriod}
                            tabs={[
                                { value: 'monthly', label: 'Monthly' },
                                { value: 'yearly', label: 'Yearly' },
                            ]}
                        />
                        <Tabs
                            fullWidth
                            aria-label="Network"
                            value={network}
                            onValueChange={setNetwork}
                            tabs={[
                                { value: 'evm', label: 'EVM' },
                                { value: 'sol', label: 'Solana' },
                                { value: 'tron', label: 'Tron' },
                            ]}
                        />
                    </div>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Value toggle"
                        code={`import { Tabs } from '@/components/0_Bruddle/Tabs'

<Tabs
    fullWidth
    aria-label="Network"
    value={network}
    onValueChange={setNetwork}
    tabs={[
        { value: 'evm', label: 'EVM' },
        { value: 'sol', label: 'Solana' },
    ]}
/>`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <PropsTable
                rows={[
                    {
                        name: 'tabs',
                        type: '{ value, label, content? }[]',
                        default: '—',
                        description:
                            'Trigger labels and their panels, in order. First tab is active. Omit content on every tab and no panel renders',
                    },
                    {
                        name: 'fullWidth',
                        type: 'boolean',
                        default: 'false',
                        description: 'Stretch the tabs to fill the row',
                    },
                    {
                        name: 'value / onValueChange',
                        type: 'string / (value: string) => void',
                        default: '—',
                        description: 'Controlled mode. Pass both, or neither for the uncontrolled default',
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
