'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { Field } from '@/components/0_Bruddle/Field'
import { Section } from '@/components/0_Bruddle/Section'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { Icon } from '@/components/Global/Icons/Icon'
import { DocPage } from './DocPage'

export type UsageStatus = 'live' | 'showcase-only' | 'dead' | 'duplicate' | 'variant' | 'canonical' | 'adhoc'

export interface UsageItem {
    name: string
    realUsages: number
    devUsages?: number
    status: UsageStatus
    source?: string
    divergence?: string
    usedIn?: string[]
    verified?: boolean
}

export interface UsageCategory {
    category: string
    layer?: string
    summary?: string
    items: UsageItem[]
}

const STATUS_META: Record<UsageStatus, { label: string; hint: string }> = {
    live: {
        label: 'live in product',
        hint: 'rendered on real app screens',
    },
    variant: {
        label: 'redundant variant',
        hint: 'used, but duplicates another impl',
    },
    duplicate: {
        label: 'duplicate',
        hint: 'same job as a canonical impl',
    },
    canonical: {
        label: 'canonical',
        hint: 'the one to keep',
    },
    adhoc: {
        label: 'ad-hoc inline',
        hint: 'reinvented inline, not the primitive',
    },
    'showcase-only': {
        label: 'SHOWCASE-ONLY',
        hint: 'exists in /dev only — product never renders it',
    },
    dead: {
        label: 'DEAD · never used',
        hint: 'referenced nowhere, delete-candidate',
    },
}
const STATUS_ORDER: UsageStatus[] = ['live', 'canonical', 'variant', 'duplicate', 'adhoc', 'showcase-only', 'dead']

function StatusChip({ status }: { status: UsageStatus }) {
    const m = STATUS_META[status] ?? STATUS_META.live
    return <span className="text-label-m whitespace-nowrap text-foreground-secondary">{m.label}</span>
}

export function UsageAudit({
    eyebrow,
    title,
    intro,
    heroClass = 'bg-background-brand',
    categories,
    footnote,
}: {
    eyebrow: string
    title: string
    intro: React.ReactNode
    heroClass?: string
    categories: UsageCategory[]
    footnote?: React.ReactNode
}) {
    const allItems = useMemo(
        () => categories.flatMap((c) => c.items.map((i) => ({ ...i, category: c.category }))),
        [categories]
    )
    const [cat, setCat] = useState<string>('all')
    const [status, setStatus] = useState<string>('all')
    const [q, setQ] = useState('')

    const counts = useMemo(() => {
        const live = allItems.filter(
            (i) => i.status === 'live' || i.status === 'canonical' || i.status === 'variant'
        ).length
        const showcase = allItems.filter((i) => i.status === 'showcase-only').length
        const dead = allItems.filter((i) => i.status === 'dead').length
        return { total: allItems.length, live, showcase, dead }
    }, [allItems])

    const catNames = useMemo(() => categories.map((c) => c.category), [categories])

    const visible = useMemo(() => {
        const ql = q.trim().toLowerCase()
        return categories
            .filter((c) => cat === 'all' || c.category === cat)
            .map((c) => ({
                ...c,
                items: c.items
                    .filter((i) => status === 'all' || i.status === status)
                    .filter(
                        (i) =>
                            !ql ||
                            i.name.toLowerCase().includes(ql) ||
                            (i.divergence || '').toLowerCase().includes(ql) ||
                            (i.source || '').toLowerCase().includes(ql)
                    )
                    .sort((a, b) => b.realUsages - a.realUsages),
            }))
            .filter((c) => c.items.length > 0)
    }, [categories, cat, status, q])

    return (
        <DocPage>
            {/* Hero — DS Card on the lens tint */}
            <Card className={`p-4 ${heroClass}`}>
                <p className="text-label-m text-foreground-over-color-secondary uppercase">{eyebrow}</p>
                <TitleBlock size="m" title={<h1>{title}</h1>} description={intro} />
            </Card>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                    { label: 'inventoried', value: counts.total },
                    { label: 'live in product', value: counts.live },
                    { label: 'showcase-only', value: counts.showcase },
                    { label: 'dead', value: counts.dead },
                ].map((s) => (
                    <Card key={s.label} className="p-2 text-center">
                        <p className="text-heading-xs">{s.value}</p>
                        <p className="text-body-xs text-foreground-secondary">{s.label}</p>
                    </Card>
                ))}
            </div>

            {/* Legend */}
            <Card className="flex-row flex-wrap gap-x-3 gap-y-2 border-dashed border-border-subtle p-3">
                {STATUS_ORDER.map((s) => (
                    <span key={s} className="flex items-center gap-1 text-body-xs text-foreground-secondary">
                        <StatusChip status={s} />
                        {STATUS_META[s].hint}
                    </span>
                ))}
            </Card>

            {/* Filters */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Search">
                    <BaseInput
                        variant="sm"
                        value={q}
                        onChange={(event) => setQ(event.target.value)}
                        placeholder="Name, divergence, or file"
                        aria-label="Search audit items"
                    />
                </Field>
                <Field label="Category">
                    <BaseSelect
                        value={cat}
                        onValueChange={setCat}
                        aria-label="Audit category"
                        options={['all', ...catNames].map((value) => ({ label: value, value }))}
                    />
                </Field>
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
            </div>

            {/* Grouped items */}
            {visible.map((c) => (
                <Section
                    key={c.category}
                    title={
                        <span className="flex items-center justify-between">
                            <span>{c.category}</span>
                            <span className="text-body-xs text-foreground-secondary">{c.items.length} shown</span>
                        </span>
                    }
                >
                    {c.summary && <p className="text-body-xs text-foreground-secondary">{c.summary}</p>}
                    <div className="space-y-2">
                        {c.items.map((i, idx) => {
                            const isDead = i.status === 'dead' || i.status === 'showcase-only'
                            return (
                                <Card
                                    key={c.category + i.name + idx}
                                    className={`p-3 ${
                                        isDead
                                            ? 'border-dashed border-border-subtle bg-background-page'
                                            : 'border-border-disabled'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-label-l">{i.name}</p>
                                        <span className="shrink-0 text-label-m text-foreground-secondary">
                                            {i.realUsages}× app
                                        </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-1">
                                        <StatusChip status={i.status} />
                                        {typeof i.devUsages === 'number' && i.devUsages > 0 && (
                                            <span className="text-body-xs text-foreground-secondary">
                                                {i.devUsages}× in /dev only
                                            </span>
                                        )}
                                        {i.verified && (
                                            <span className="flex items-center gap-1 text-body-xs text-foreground-secondary">
                                                <Icon name="check" size={16} /> re-verified
                                            </span>
                                        )}
                                    </div>
                                    {i.divergence && (
                                        <p className="mt-2 text-body-xs text-foreground-secondary">{i.divergence}</p>
                                    )}
                                    {i.source && (
                                        <p className="mt-1 truncate font-mono text-body-xs text-foreground-secondary/80">
                                            {i.source}
                                        </p>
                                    )}
                                    {i.usedIn && i.usedIn.length > 0 && (
                                        <p className="mt-1 font-mono text-body-xs text-foreground-secondary/70">
                                            used in: {i.usedIn.slice(0, 4).join(' · ')}
                                        </p>
                                    )}
                                </Card>
                            )
                        })}
                    </div>
                </Section>
            ))}

            {footnote && (
                <Card className="border-dashed border-border-subtle p-3 text-body-xs text-foreground-secondary">
                    {footnote}
                </Card>
            )}
        </DocPage>
    )
}
