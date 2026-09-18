'use client'

import { type ReactNode } from 'react'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Section } from '@/components/0_Bruddle/Section'
import Card from '@/components/Global/Card'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import DevPageShell from '../_components/DevPageShell'
import { ProposalTabs, type TabDef, type VariantKey } from './_components/TabVariants'

/**
 * /dev/tabs-proposals — TASK-22707: 6 candidate looks for the ONE `0_Bruddle/Tabs`
 * component, so the owner can pick one.
 *
 * The task deletes `SegmentedControl`. #3251 did the structural half — `content`
 * is optional on a TabDef, and with no tab carrying content no panel renders —
 * which is kept. What it also added, a second `pill` variant copying
 * SegmentedControl's `border-action-primary` + `bg-action-primary/10` look, is
 * what this page replaces: the point of the task is ONE tabs UI, not two.
 *
 * Every look is rendered in the two modes it has to survive:
 *   - standalone (7 of 10 call sites: limits, RhinoDeposit, ExplorerHeader,
 *     FilterPanel, 3 dev routes) — trigger row alone, no panel below
 *   - panelled (TokenSelector, Marketing/mdx/Tabs) — trigger row over a panel
 * plus fullWidth, icon+text labels, the keyboard focus ring, and overflow.
 *
 * Nothing here ships. `0_Bruddle/Tabs` and all 10 call sites are untouched; the
 * winner is applied in a separate PR and this directory is deleted.
 */

// ---------------------------------------------------------------- demo tab sets
// real copy from the real call sites, so the labels are the lengths that ship

/** limits period toggle — MantecaLimitsView */
const PERIOD_TABS: TabDef[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
]

/** network type toggle — RhinoDeposit.view (the fullWidth case) */
const NETWORK_TABS: TabDef[] = [
    { value: 'EVM', label: 'EVM' },
    { value: 'SOL', label: 'Solana' },
    { value: 'TRON', label: 'Tron' },
]

/** explorer view toggle — ExplorerHeader (the focus-state demo) */
const VIEW_TABS: TabDef[] = [
    { value: 'graph', label: 'Graph' },
    { value: 'table', label: 'Table' },
]

/** direction filter — FilterPanel (fullWidth, three uneven labels) */
const DIRECTION_TABS: TabDef[] = [
    { value: 'all', label: 'All' },
    { value: 'one-way', label: 'One-way' },
    { value: 'both', label: 'Both ways' },
]

const iconLabel = (icon: IconName, text: string): ReactNode => (
    <>
        <Icon name={icon} size={16} />
        {text}
    </>
)

/** icon + text labels — the TokenSelector case (label is a ReactNode) */
const SOURCE_TABS: TabDef[] = [
    { value: 'bank', label: iconLabel('bank', 'Bank') },
    { value: 'card', label: iconLabel('credit-card', 'Card') },
    { value: 'crypto', label: iconLabel('wallet', 'Crypto') },
]

/** 8 tabs: forces the horizontal overflow at 375px */
const OVERFLOW_TABS: TabDef[] = [
    { value: 'all', label: 'All' },
    { value: 'sent', label: 'Sent' },
    { value: 'received', label: 'Received' },
    { value: 'requests', label: 'Requests' },
    { value: 'links', label: 'Links' },
    { value: 'cashback', label: 'Cashback' },
    { value: 'card', label: 'Card' },
    { value: 'deposits', label: 'Deposits' },
]

const panel = (rows: [string, string][]): ReactNode => (
    <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
        {rows.map(([label, value]) => (
            <DataRow key={label} label={label} value={value} />
        ))}
    </Card>
)

/** the panelled case: triggers over a panel they belong to */
const PANELLED_TABS: TabDef[] = [
    {
        value: 'details',
        label: 'Details',
        content: panel([
            ['Created', '12 Sep 2026'],
            ['Fee', '$0.10'],
            ['Total', '$50.10'],
        ]),
    },
    {
        value: 'limits',
        label: 'Limits',
        content: panel([
            ['Daily spend', '$430 / $1,000'],
            ['Monthly spend', '$1,890 / $10,000'],
        ]),
    },
    {
        value: 'history',
        label: 'History',
        content: panel([
            ['Bank deposit', '+$50.00'],
            ['Card payment', '-$12.40'],
            ['Cashback', '+$0.62'],
        ]),
    },
]

// ------------------------------------------------------------------- the looks

interface Proposal {
    key: VariantKey
    name: string
    pitch: string
    /** which token paints "selected" */
    selectedToken: string
    /** does globals.css need a new token for this look */
    newToken: string
    /** the mode it serves worse, said plainly */
    weakerMode: string
    /** the same look applied to NetworkListItem as a selected list row */
    listRow: string
}

const PROPOSALS: Proposal[] = [
    {
        key: 'rule',
        name: 'Rule',
        pitch: 'The row sits on a full-width rule; the active tab thickens it to 2px under its own label. No fill anywhere.',
        selectedToken: 'border-border-default (2px) + text-foreground-primary. No fill, no alpha.',
        newToken: 'No. Both tokens already exist and are already used this way.',
        weakerMode:
            'Standalone, and worst at fullWidth: a full-width rule under a filter row reads as a section divider, not as a control. In a dense header (ExplorerHeader) the row is quiet enough to be missed.',
        listRow:
            'Poor. A list row already has borders on all four sides, so a selected row has no free edge to thicken — it would need a left rule, which no board has.',
    },
    {
        key: 'awning',
        name: 'Awning',
        pitch: 'The affordance sits on top: the active tab wears a 2px brand cap over a white fill, so the row reads as cards standing up.',
        selectedToken:
            'border-action-primary (2px cap) + bg-background-default. Brand as a 2px line, never as a surface.',
        newToken: 'No.',
        weakerMode:
            'Standalone. With no panel under it the white fill has no bottom edge to sit on, so the cap floats over a shape that stops mid-air. On background-default it disappears entirely and only the pink cap is left.',
        listRow: 'Poor. A cap on a list row reads as a divider between rows, not as a selection.',
    },
    {
        key: 'blush',
        name: 'Blush',
        pitch: 'The active tab is a solid brand block. The loudest option, and the only one that answers the selected-surface question with a yes.',
        selectedToken:
            'bg-action-primary + text-foreground-over-color-primary (the token that exists for exactly this: text on a brand fill).',
        newToken: 'No — and it kills the alpha hack: solid action-primary instead of action-primary/10.',
        weakerMode:
            'Panelled. A saturated pink block directly above a bordered white panel competes with the panel content. Pink is also the CTA color, so a selected tab can read as a button to press rather than a state.',
        listRow:
            'Direct. A selected row fills action-primary — which is exactly what ui#3232 already shipped on NetworkListItem. Picking Blush ratifies that change instead of leaving it pending.',
    },
    {
        key: 'frame',
        name: 'Frame',
        pitch: 'The active tab is a bordered white box — the shipped card look with the weld to the panel cut off. Identical geometry in both modes.',
        selectedToken:
            'border-border-default + bg-background-default. The same pair every DS card and ListItem already uses.',
        newToken: 'No.',
        weakerMode:
            'Panelled. Unwelded, there is a visible seam between the trigger and the panel where the shipped look had none, so the "these belong together" cue is weaker than today.',
        listRow:
            'Good. A selected row keeps the black border and white fill while unselected rows drop to border-subtle — no fill, no new token, and it matches the ListItem board vocabulary.',
    },
    {
        key: 'weight',
        name: 'Weight',
        pitch: 'Type only: no rule, no border, no fill. The active label goes black and semibold, the rest stay secondary.',
        selectedToken:
            'text-foreground-primary + font-semibold. Nothing else — the most restrained option on the page.',
        newToken: 'No.',
        weakerMode:
            'Standalone, badly. With no rule and no fill a row of words in a header is not obviously a control at all, and at fullWidth nothing marks where one segment ends and the next begins.',
        listRow: 'Poor. A list of rows whose only difference is title weight gives no scannable selected state.',
    },
    {
        key: 'track',
        name: 'Track',
        pitch: 'The row is a recessed container and the active tab is a card raised out of it — the iOS segmented shape, in DS tokens.',
        selectedToken: 'bg-background-default + border-border-default, on a bg-background-page track.',
        newToken:
            'YES — the only one that needs one. background-page is the PAGE tint borrowed as a control surface, so the track vanishes on every page that uses it (/home, every AppShell screen). A real --color-background-track would have to be added and ruled.',
        weakerMode:
            'Panelled. A recessed track above a bordered panel is two containers stacked, which reads as chrome on chrome. It also breaks the overflow case: a scrolling track has no visible end.',
        listRow: 'Does not translate. A list is not a track; there is nothing to recess.',
    },
]

// ---------------------------------------------------------------- page scaffold

const DemoLabel = ({ children }: { children: ReactNode }) => (
    <p className="text-label-m text-foreground-secondary uppercase">{children}</p>
)

const Demo = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex flex-col gap-2">
        <DemoLabel>{label}</DemoLabel>
        <div className="bg-background-default p-4">{children}</div>
    </div>
)

const NoteRow = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex flex-col gap-1 py-3">
        <p className="text-label-m text-foreground-secondary uppercase">{label}</p>
        <p className="text-body-s text-foreground-primary">{children}</p>
    </div>
)

export default function TabsProposalsPage() {
    return (
        <DevPageShell
            title="Tabs looks"
            description="TASK-22707 — 6 candidate looks for the ONE 0_Bruddle/Tabs component, after SegmentedControl is deleted. Each look is shown in both modes it has to survive: standalone (no panel, 7 of 10 call sites) and panelled. Arrow keys move between tabs. Nothing here ships."
            width="prose"
        >
            <div className="flex flex-col gap-10">
                <Notification priority="info" title="Picking one also rules the selected surface">
                    The design system has no selected-surface token. SegmentedControl painted selection with
                    bg-action-primary/10, an alpha-modified brand token; NetworkListItem copied it, and ui#3232 changed
                    that row to solid bg-action-primary while waiting for this ruling. Whichever look wins becomes the
                    app-wide precedent for &ldquo;this one is selected&rdquo; and unblocks NetworkListItem. Each note
                    below says which token paints selected and whether globals.css needs a new one.
                </Notification>

                {PROPOSALS.map((proposal, index) => (
                    <Section key={proposal.key} title={`${index + 1} — ${proposal.name}`} className="gap-4">
                        <p className="text-body-s text-foreground-secondary">{proposal.pitch}</p>

                        <Demo label="a · standalone, compact — limits period">
                            <ProposalTabs
                                variant={proposal.key}
                                tabs={PERIOD_TABS}
                                aria-label={`${proposal.name}, period`}
                            />
                        </Demo>

                        <Demo label="b · standalone, fullWidth — rhino networks + filter direction">
                            <div className="flex flex-col gap-4">
                                <ProposalTabs
                                    variant={proposal.key}
                                    tabs={NETWORK_TABS}
                                    aria-label={`${proposal.name}, network`}
                                    fullWidth
                                />
                                <ProposalTabs
                                    variant={proposal.key}
                                    tabs={DIRECTION_TABS}
                                    aria-label={`${proposal.name}, direction`}
                                    fullWidth
                                />
                            </div>
                        </Demo>

                        <Demo label="c · panelled — triggers over a content panel">
                            <ProposalTabs
                                variant={proposal.key}
                                tabs={PANELLED_TABS}
                                aria-label={`${proposal.name}, panelled`}
                                forceMount
                            />
                        </Demo>

                        <Demo label="d · icon + text labels — tokenselector">
                            <ProposalTabs
                                variant={proposal.key}
                                tabs={SOURCE_TABS}
                                aria-label={`${proposal.name}, source`}
                            />
                        </Demo>

                        <Demo label="e · keyboard focus — 3px action-focus ring">
                            <ProposalTabs
                                variant={proposal.key}
                                tabs={VIEW_TABS}
                                aria-label={`${proposal.name}, view`}
                                forceFocusIndex={1}
                            />
                        </Demo>

                        <Demo label="f · overflow — 8 tabs, scrolls sideways">
                            <ProposalTabs
                                variant={proposal.key}
                                tabs={OVERFLOW_TABS}
                                aria-label={`${proposal.name}, overflow`}
                            />
                        </Demo>

                        <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
                            <NoteRow label="Selected token">{proposal.selectedToken}</NoteRow>
                            <NoteRow label="Needs a new globals.css token">{proposal.newToken}</NoteRow>
                            <NoteRow label="Serves this mode worse">{proposal.weakerMode}</NoteRow>
                            <NoteRow label="As a NetworkListItem selected row">{proposal.listRow}</NoteRow>
                        </Card>
                    </Section>
                ))}

                <Notification priority="info" title="Scope">
                    These looks live only under /dev/tabs-proposals. 0_Bruddle/Tabs and all 10 call sites are untouched
                    by this PR. The winner is applied to the real component in a separate PR — with a figma board, per
                    design.md — and this directory is deleted then.
                </Notification>
            </div>
        </DevPageShell>
    )
}
