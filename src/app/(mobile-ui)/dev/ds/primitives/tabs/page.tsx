'use client'

import { useState } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'
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
import { Callout } from '@/components/0_Bruddle/Callout'

const historyRows = [
    { icon: 'bank', title: 'Bank deposit', body: '12 Sep 2026', amount: '+$50.00' },
    { icon: 'credit-card', title: 'Card payment', body: '10 Sep 2026', amount: '-$12.40' },
] as const

export default function TabsPage() {
    const [period, setPeriod] = useState('monthly')
    const [network, setNetwork] = useState('evm')
    const [chain, setChain] = useState('arb')

    return (
        <DocPage>
            <DocHeader
                title="Tabs"
                description="The ONE tab component for product and marketing — one look, no variants. It is the app's own bottom navigation standing still (ruled 2026-09-21, TASK-22707, which also absorbed SegmentedControl): a bordered white pill track carrying a bordered page-tint chip, sharing its resting surface with BottomNav through 0_Bruddle/PillSurface. The chip is welded FLUSH — the track has no padding and the chip is drawn 1px outside the trigger, so its border lands on the track's. The two fills are only 1.09:1 apart, so selection is carried by that 1px border, the label colour, and — ruled 2026-09-21 — the label weight: active steps from 500 to 600 on the matching semibold type token. Static: no shadow, no slide, no spring. Code-first, figma board pending."
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

            <DocSection
                title="Sizes"
                description="Three, ruled 2026-09-21. `size` changes ONLY the height, the horizontal padding, the text-token PAIR and the icon-to-label gap. Every size carries two type tokens on mutually exclusive state selectors — inactive at weight 500, active at 600 — never a type token plus a raw `font-semibold`. The chip weld, the track border, the radius, the focus ring, the scroll gutter and the panel spacing are identical in all three — a unit test asserts that, so a size can never quietly grow a fourth difference."
            >
                <DocSection.Content>
                    <div className="flex flex-col gap-4">
                        {(['sm', 'md', 'lg'] as const).map((s) => (
                            <div key={s} className="flex flex-col gap-1">
                                <span className="text-label-m text-foreground-secondary uppercase">{s}</span>
                                {/* uncontrolled on purpose: each row owns its own
                                    selection, so clicking a segment activates THAT
                                    segment. Sharing one `size` state across the three
                                    rows made Monthly a no-op. */}
                                <Tabs
                                    size={s}
                                    aria-label={`Size ${s}`}
                                    tabs={[
                                        { value: 'a', label: 'Monthly' },
                                        { value: 'b', label: 'Yearly' },
                                    ]}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 overflow-x-auto">
                        <table className="w-max min-w-full border border-border-default text-left">
                            <thead className="bg-background-page">
                                <tr>
                                    {['size', 'height', 'padding', 'text (inactive)', 'text (active)', 'gap'].map(
                                        (h) => (
                                            <th
                                                key={h}
                                                className="border-b border-border-default px-3 py-2 text-label-m text-foreground-secondary uppercase"
                                            >
                                                {h}
                                            </th>
                                        )
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    [
                                        'sm',
                                        'min-h-9 · 36px',
                                        'px-3 · 12px',
                                        'text-body-s · 14px/500',
                                        'text-body-s-semibold · 14px/600',
                                        'gap-1 · 4px',
                                    ],
                                    [
                                        'md (default)',
                                        'min-h-11 · 44px',
                                        'px-4 · 16px',
                                        'text-body-m · 16px/500',
                                        'text-body-m-semibold · 16px/600',
                                        'gap-1 · 4px',
                                    ],
                                    [
                                        'lg',
                                        'min-h-13 · 52px',
                                        'px-6 · 24px',
                                        'text-body-m · 16px/500',
                                        'text-body-m-semibold · 16px/600',
                                        'gap-2 · 8px',
                                    ],
                                ].map((row) => (
                                    <tr key={row[0]}>
                                        {row.map((cell, i) => (
                                            <td
                                                key={cell}
                                                className={`border-b border-border-default px-3 py-2 text-body-s ${i === 0 ? 'text-foreground-primary' : 'font-mono text-foreground-secondary'}`}
                                            >
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <Callout priority="attention" title="sm is 36px — under the 44px touch minimum">
                        It clears WCAG 2.5.8 AA (24px) but misses 2.5.5 AAA and Apple&apos;s 44pt guidance. Accepted by
                        kush on 2026-09-21 for dense control panels, pending a real-device test. Use it for the Manteca
                        period toggle, the explorer filter panel, the content-hub filters and the dev panels — never for
                        a primary control.
                    </Callout>

                    <p className="mt-4 text-body-s text-foreground-secondary">
                        <strong className="text-foreground-primary">lg is the MDX article tabs</strong> (ruled
                        2026-09-21). It lands on BottomNav&apos;s own 52px / px-6 so a large tab row and the nav read as
                        one family, and the marketing article tabs are the surface that earns it: panelled, `forceMount`
                        for crawlers, and read on a desktop. Product controls stay on the 44px `md` default.
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="Sizes"
                        code={`import { Tabs } from '@/components/0_Bruddle/Tabs'

// md is the default — omit the prop
<Tabs aria-label="Period" tabs={periodTabs} />

// dense control panels only
<Tabs size="sm" aria-label="Period" tabs={periodTabs} />

// lg — marketing article tabs (Marketing/mdx/Tabs)
<Tabs size="lg" aria-label="Content tabs" tabs={articleTabs} forceMount />`}
                    />
                </DocSection.Code>
            </DocSection>

            <SectionDivider />

            <DocSection
                title="Icon + text labels, and focus"
                description="`label` is a ReactNode, so a tab can carry an icon beside its name — that is what the token selector's network row does. Keyboard focus draws the full DS ring (3px `action-focus`, never pink): tab into the row below and use the arrow keys."
            >
                <DocSection.Content>
                    <Tabs
                        aria-label="Network"
                        value={chain}
                        onValueChange={setChain}
                        tabs={[
                            { value: 'all', label: 'All' },
                            {
                                value: 'arb',
                                label: (
                                    <>
                                        <Icon name="arrow-up-right" size={16} /> Arbitrum
                                    </>
                                ),
                            },
                            {
                                value: 'base',
                                label: (
                                    <>
                                        <Icon name="arrow-up-right" size={16} /> Base
                                    </>
                                ),
                            },
                        ]}
                    />
                </DocSection.Content>
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
                        name: 'size',
                        type: "'sm' | 'md' | 'lg'",
                        default: "'md'",
                        description:
                            'Row scale — height, horizontal padding, the text-token pair (inactive 500 / active 600) and icon gap only. sm is 36px, under the 44px touch minimum; lg is the MDX article tabs',
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
