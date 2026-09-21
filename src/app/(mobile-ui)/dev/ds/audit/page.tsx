'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { Card } from '@/components/0_Bruddle/Card'
import { Field } from '@/components/0_Bruddle/Field'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { DocPage } from '../_components/DocPage'
import type { AuditCluster, AuditItem, AuditStatus, LayerStat } from './audit-data'

// build-time gate — mirrors DEV_TOOLS_ENABLED (src/constants/dev-tools.consts.ts).
// next inlines process.env.NODE_ENV / NEXT_PUBLIC_* at compile time, so in a prod
// build webpack folds this condition to `false` and drops the require()'d branch —
// ~360KB of audit data never enters the prod bundle. two things keep the fold
// working: (1) the condition must stay inline — importing DEV_TOOLS_ENABLED hides
// the literals from webpack's parser and the data would ship; (2) both next
// configs define NEXT_PUBLIC_VERCEL_ENV unconditionally (see next.config.js `env`)
// so the second leg is always a foldable literal, even off-Vercel. runtime access
// is still blocked by the notFound() in dev/layout.tsx; a prod build just renders
// this page empty.
const auditData =
    process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'
        ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional require IS the tree-shaking mechanism; import() would code-split the data into a chunk that still ships
          (require('./audit-data') as typeof import('./audit-data'))
        : null

const AUDIT_ITEMS: AuditItem[] = auditData?.AUDIT_ITEMS ?? []
const AUDIT_CLUSTERS: AuditCluster[] = auditData?.AUDIT_CLUSTERS ?? []
const LAYER_STATS: LayerStat[] = auditData?.LAYER_STATS ?? []

const STATUS_META: Record<AuditStatus, { label: string }> = {
    canonical: { label: 'canonical' },
    variant: { label: 'variant' },
    duplicate: { label: 'duplicate' },
    adhoc: { label: 'ad-hoc inline' },
    dead: { label: 'DEAD · never used' },
}
const STATUS_ORDER: AuditStatus[] = ['canonical', 'variant', 'duplicate', 'adhoc', 'dead']
const LAYERS = ['tokens', 'styles', 'primitives', 'components', 'patterns', 'templates']

function StatusChip({ status }: { status: AuditStatus }) {
    const m = STATUS_META[status]
    return <span className="text-label-m whitespace-nowrap text-foreground-secondary">{m.label}</span>
}

export default function DesignSystemAuditPage() {
    const [tab, setTab] = useState<'inventory' | 'clusters'>('inventory')
    const [layer, setLayer] = useState<string>('all')
    const [status, setStatus] = useState<string>('all')
    const [q, setQ] = useState('')

    const totals = useMemo(() => {
        const dead = AUDIT_ITEMS.filter((i) => i.status === 'dead').length
        return { items: AUDIT_ITEMS.length, dead, clusters: AUDIT_CLUSTERS.length }
    }, [])

    const items = useMemo(() => {
        const ql = q.trim().toLowerCase()
        return AUDIT_ITEMS.filter(
            (i) =>
                (layer === 'all' || i.layer === layer) &&
                (status === 'all' || i.status === status) &&
                (!ql ||
                    i.name.toLowerCase().includes(ql) ||
                    i.catLabel.toLowerCase().includes(ql) ||
                    i.notes.toLowerCase().includes(ql))
        ).sort((a, b) => b.usages - a.usages)
    }, [layer, status, q])

    const grouped = useMemo(() => {
        const g: Record<string, typeof items> = {}
        for (const i of items) (g[i.catLabel] ||= []).push(i)
        return Object.entries(g).sort((a, b) => b[1].length - a[1].length)
    }, [items])

    const clusters = useMemo(() => {
        const ql = q.trim().toLowerCase()
        return AUDIT_CLUSTERS.filter(
            (c) =>
                (layer === 'all' || c.layer === layer) &&
                (!ql ||
                    c.name.toLowerCase().includes(ql) ||
                    c.rec.toLowerCase().includes(ql) ||
                    c.collapses.join(' ').toLowerCase().includes(ql))
        ).sort((a, b) => b.from - a.from)
    }, [layer, q])

    return (
        <DocPage>
            {/* Hero */}
            <Card className="bg-background-brand p-4">
                <p className="text-label-m text-foreground-primary/70 uppercase">Design System · Code Audit</p>
                <TitleBlock
                    size="m"
                    title={<h1>Code-level consolidation</h1>}
                    description="A code audit of distinct implementations and their call-site counts."
                />
                <p className="mt-2 text-body-xs text-foreground-primary/70">
                    Snapshot as of 2026-09-18. The numbers are frozen at that date — later PRs (TASK-22817 and after)
                    have already changed some of them.
                </p>
            </Card>

            {/* Scope caveat + cross-link to the app-usage audit */}
            <Callout priority="attention" title="This is a code audit, not an app-usage audit.">
                Counts here are raw call-sites across <code>src/</code> — they include the <code>/dev</code> showcase
                and tests, so a high count does <span className="text-body-s-semibold">not</span> mean the live product
                renders it. For &ldquo;what the real app actually shows&rdquo; (and what&rsquo;s dead-in-product despite
                existing in code), see{' '}
                <Link href="/dev/ds/audit/app" className="text-body-s-semibold underline">
                    App Divergences →
                </Link>
            </Callout>

            {/* Quick stats */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                    { label: 'inventoried', value: String(totals.items) },
                    { label: 'flagged dead', value: String(totals.dead) },
                    { label: 'merge clusters', value: String(totals.clusters) },
                ].map((s) => (
                    <Card key={s.label} className="p-3 text-center">
                        <p className="text-heading-s">{s.value}</p>
                        <p className="text-body-xs text-foreground-secondary">{s.label}</p>
                    </Card>
                ))}
            </div>

            {/* Layer reduction table */}
            <div className="overflow-x-auto rounded-sm border border-border-default">
                <table className="w-full text-left text-body-xs">
                    <thead className="bg-background-page">
                        <tr>
                            <th className="px-3 py-2 text-label-m">Layer</th>
                            <th className="px-3 py-2 text-right text-label-m">Today</th>
                            <th className="px-3 py-2 text-right text-label-m">Target</th>
                            <th className="px-3 py-2 text-right text-label-m">Cut</th>
                        </tr>
                    </thead>
                    <tbody>
                        {LAYER_STATS.map((l) => (
                            <tr key={l.layer} className="border-t border-border-disabled">
                                <td className="px-3 py-2 text-body-s-semibold capitalize">{l.layer}</td>
                                <td className="px-3 py-2 text-right">{l.distinct}</td>
                                <td className="px-3 py-2 text-right">{l.target}</td>
                                <td className="px-3 py-2 text-right text-foreground-secondary">
                                    −{Math.round((1 - l.target / l.distinct) * 100)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Search">
                    <BaseInput value={q} onChange={(event) => setQ(event.target.value)} placeholder="Name or notes" />
                </Field>
                <Field label="View">
                    <BaseSelect
                        value={tab}
                        onValueChange={(value) => setTab(value as 'inventory' | 'clusters')}
                        aria-label="Audit view"
                        options={[
                            { label: `Inventory (${items.length})`, value: 'inventory' },
                            { label: `Clusters (${clusters.length})`, value: 'clusters' },
                        ]}
                    />
                </Field>
                <Field label="Layer">
                    <BaseSelect
                        value={layer}
                        onValueChange={setLayer}
                        aria-label="Audit layer"
                        options={['all', ...LAYERS].map((value) => ({ label: value, value }))}
                    />
                </Field>
                {tab === 'inventory' && (
                    <Field label="Status">
                        <BaseSelect
                            value={status}
                            onValueChange={setStatus}
                            aria-label="Audit status"
                            options={[
                                { label: 'all status', value: 'all' },
                                ...STATUS_ORDER.map((value) => ({ label: STATUS_META[value].label, value })),
                            ]}
                        />
                    </Field>
                )}
            </div>

            {/* Inventory */}
            {tab === 'inventory' &&
                grouped.map(([cat, list]) => (
                    <Section
                        key={cat}
                        title={
                            <span className="flex items-center justify-between">
                                <span>{cat}</span>
                                <span className="text-body-xs text-foreground-secondary">{list.length} impls</span>
                            </span>
                        }
                    >
                        <div className="space-y-2">
                            {list.map((i, idx) => (
                                <Card
                                    key={cat + idx}
                                    className={`rounded-sm border p-3 ${
                                        i.status === 'dead'
                                            ? 'border-dashed border-border-subtle bg-background-page'
                                            : 'border-border-disabled bg-background-default'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="min-w-0 text-label-l break-words">{i.name}</p>
                                        <span className="shrink-0 text-label-m text-foreground-secondary">
                                            {i.usages}×
                                        </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-1">
                                        <StatusChip status={i.status} />
                                        {i.role && (
                                            <span className="text-body-xs text-foreground-secondary">{i.role}</span>
                                        )}
                                    </div>
                                    {i.notes && (
                                        <p className="mt-2 text-body-xs text-foreground-secondary">{i.notes}</p>
                                    )}
                                    {i.source && (
                                        <p className="mt-1 truncate font-mono text-body-xs text-foreground-secondary/80">
                                            {i.source}
                                        </p>
                                    )}
                                </Card>
                            ))}
                        </div>
                    </Section>
                ))}

            {/* Clusters */}
            {tab === 'clusters' &&
                clusters.map((c, idx) => (
                    <Card key={idx} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 text-label-l break-words">→ {c.name}</p>
                            {c.from > 0 && (
                                <span className="shrink-0 text-label-m text-foreground-secondary">{c.from} → 1</span>
                            )}
                        </div>
                        <p className="mt-0.5 text-label-m text-foreground-secondary uppercase">{c.catLabel}</p>
                        {c.collapses.length > 0 && (
                            <p className="mt-2 text-body-xs text-foreground-secondary">
                                <span className="text-body-s-semibold text-foreground-primary">collapses:</span>{' '}
                                {c.collapses.join(' · ')}
                            </p>
                        )}
                        {c.rec && <p className="mt-2 text-body-xs text-foreground-primary">{c.rec}</p>}
                    </Card>
                ))}

            <Card className="border-dashed border-border-subtle p-3 text-body-xs text-foreground-secondary">
                Counts are call-site greps over <code>src/</code> (all usages, incl. some dev/test). “DEAD” = a delete-
                <em>candidate</em> to confirm, not an auto-delete — two items were re-classified live after manual
                re-grep.
            </Card>
        </DocPage>
    )
}
