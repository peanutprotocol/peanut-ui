'use client'

import { type ComponentType, type ReactNode } from 'react'
import { BulletList } from '@/components/0_Bruddle/BulletList'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Section } from '@/components/0_Bruddle/Section'
import Card from '@/components/Global/Card'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import DevPageShell from '../_components/DevPageShell'
import { ContainedTabs, PillTabs, type TabDef, TextTabs, UnderlineTabs } from './_components/TabVariants'

/**
 * /dev/tabs-proposals — 4 DS-pure candidates for the one consolidated Tab
 * component (replacing Marketing/mdx/Tabs; SegmentedControl stays a separate
 * control). Each variant renders twice: product-ish content (list rows,
 * receipt card) and marketing-ish content (article prose), so both surfaces
 * are judged in one look. Product demos carry 5 tabs to show the 320px
 * overflow behavior (A/B/D scroll, C wraps).
 */

// --- product-ish panels (details / history / settings mock) ---

const receiptPanel = (
    <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
        <DataRow label="Created" value="12 Sep 2026" />
        <DataRow label="Fee" value="$0.10" />
        <DataRow label="Total" value="$50.10" />
        <DataRow label="Tx hash" value="0x8f3a…c21b" allowCopy copyValue="0x8f3ac21b" />
    </Card>
)

const historyRows = [
    { icon: 'bank', title: 'Bank deposit', body: '12 Sep 2026', amount: '+$50.00' },
    { icon: 'credit-card', title: 'Card payment', body: '10 Sep 2026', amount: '-$12.40' },
    { icon: 'dollar', title: 'Cashback', body: '8 Sep 2026', amount: '+$0.62' },
] as const

const historyPanel = (
    <div className="flex flex-col">
        {historyRows.map((row, index) => (
            <ListItem
                key={row.title}
                position={getCardPosition(index, historyRows.length)}
                leading={<IconBubble icon={row.icon} />}
                title={row.title}
                body={row.body}
                trailing={<span className="text-body-m-semibold text-foreground-primary">{row.amount}</span>}
            />
        ))}
    </div>
)

const settingsPanel = (
    <div className="flex flex-col">
        <ListItem
            position="first"
            leading={<IconBubble icon="bank" />}
            title="Linked accounts"
            body="2 accounts"
            chevron
        />
        <ListItem position="last" leading={<IconBubble icon="bell" />} title="Notifications" body="Push on" chevron />
    </div>
)

const limitsPanel = (
    <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
        <DataRow label="Daily spend" value="$430 / $1,000" />
        <DataRow label="Monthly spend" value="$1,890 / $10,000" />
    </Card>
)

const activityPanel = <p className="text-body-s text-foreground-secondary">No new activity this week.</p>

// 5 tabs on purpose: proves each variant's 320px overflow story
const PRODUCT_TABS: TabDef[] = [
    { value: 'details', label: 'Details', content: receiptPanel },
    { value: 'history', label: 'History', content: historyPanel },
    { value: 'settings', label: 'Settings', content: settingsPanel },
    { value: 'limits', label: 'Limits', content: limitsPanel },
    { value: 'activity', label: 'Activity', content: activityPanel },
]

// --- marketing-ish panels (article prose, the mdx/Tabs use case) ---

const prosePanel = (name: string, fee: string, points: string[]) => (
    <div className="flex flex-col gap-3">
        <h3 className="text-heading-card text-foreground-primary">Sending $500 with {name}</h3>
        <p className="text-body-l text-foreground-primary">
            {name} charges {fee} on a typical $500 transfer to Argentina. The money arrives in local currency, and the
            exchange rate applied at send time decides most of the real cost.
        </p>
        <BulletList items={points} />
    </div>
)

const MARKETING_TABS: TabDef[] = [
    {
        value: 'peanut',
        label: 'Peanut',
        content: prosePanel('Peanut', 'no transfer fee', [
            'Mid-market exchange rate',
            'Arrives in minutes',
            'Pay with QR at local shops',
        ]),
    },
    {
        value: 'wise',
        label: 'Wise',
        content: prosePanel('Wise', 'a 1.2% fee', [
            'Mid-market rate plus fee',
            'Arrives in hours',
            'No local QR payments',
        ]),
    },
    {
        value: 'western-union',
        label: 'Western Union',
        content: prosePanel('Western Union', 'a $9.99 fee', [
            'Marked-up exchange rate',
            'Cash pickup available',
            'Arrives in 1-2 days',
        ]),
    },
    {
        value: 'revolut',
        label: 'Revolut',
        content: prosePanel('Revolut', 'a weekend markup', [
            'Fair rate on weekdays',
            'App-only',
            'Limited coverage in LatAm',
        ]),
    },
]

// --- the proposals ---

const VARIANTS: {
    letter: string
    name: string
    description: string
    Tabs: ComponentType<{ tabs: TabDef[]; 'aria-label': string }>
}[] = [
    {
        letter: 'A',
        name: 'Underline',
        description: '2px action-primary underline on the active tab over a divider rule; overflow scrolls.',
        Tabs: UnderlineTabs,
    },
    {
        letter: 'B',
        name: 'Contained',
        description: 'Active tab is a bordered card-top joined to a bordered panel; overflow scrolls.',
        Tabs: ContainedTabs,
    },
    {
        letter: 'C',
        name: 'Pills',
        description: 'SegmentedControl-adjacent pill row with full tab-panel semantics; overflow wraps.',
        Tabs: PillTabs,
    },
    {
        letter: 'D',
        name: 'Text',
        description: 'Minimal labels over a divider rule; active turns foreground-primary semibold; overflow scrolls.',
        Tabs: TextTabs,
    },
]

const demoLabel = (text: string): ReactNode => <p className="text-body-xs text-foreground-secondary">{text}</p>

export default function TabsProposalsPage() {
    return (
        <DevPageShell
            title="Tabs proposals"
            description="4 DS-pure candidates for the one consolidated Tab component — product and marketing surfaces. Replaces Marketing/mdx/Tabs; SegmentedControl stays a separate control. Arrow keys move between tabs (radix)."
            width="prose"
        >
            <div className="flex flex-col gap-10">
                {VARIANTS.map(({ letter, name, description, Tabs }) => (
                    <Section key={letter} title={`${letter} — ${name}`} className="gap-4">
                        <p className="text-body-s text-foreground-secondary">{description}</p>
                        <div className="flex flex-col gap-2">
                            {demoLabel('Product context — 5 tabs (overflow demo at 320px)')}
                            <Tabs tabs={PRODUCT_TABS} aria-label={`${name} tabs, product demo`} />
                        </div>
                        <div className="flex flex-col gap-2">
                            {demoLabel('Marketing context — article prose (mdx/Tabs use case)')}
                            <Tabs tabs={MARKETING_TABS} aria-label={`${name} tabs, marketing demo`} />
                        </div>
                    </Section>
                ))}

                <Notification priority="info" title="Proposal scope">
                    These variants live only under /dev/tabs-proposals. The winning variant gets a figma board first,
                    then a promoted 0_Bruddle component; this page and its drafts are then deleted.
                </Notification>
            </div>
        </DevPageShell>
    )
}
