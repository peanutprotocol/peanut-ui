'use client'

import { useMemo, useState } from 'react'
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

const STATUS_META: Record<UsageStatus, { label: string; cls: string; hint: string }> = {
    live: { label: 'live in product', cls: 'bg-green-1/40 text-n-1 border-n-1', hint: 'rendered on real app screens' },
    variant: {
        label: 'redundant variant',
        cls: 'bg-secondary-6 text-n-1 border-n-1',
        hint: 'used, but duplicates another impl',
    },
    duplicate: { label: 'duplicate', cls: 'bg-error-1/60 text-n-1 border-n-1', hint: 'same job as a canonical impl' },
    canonical: { label: 'canonical', cls: 'bg-primary-1/50 text-n-1 border-n-1', hint: 'the one to keep' },
    adhoc: {
        label: 'ad-hoc inline',
        cls: 'bg-yellow-1/50 text-n-1 border-n-1',
        hint: 'reinvented inline, not the primitive',
    },
    'showcase-only': {
        label: 'SHOWCASE-ONLY',
        cls: 'bg-yellow-1/30 text-grey-1 border-grey-1',
        hint: 'exists in /dev only — product never renders it',
    },
    dead: {
        label: 'DEAD · never used',
        cls: 'bg-n-1/10 text-grey-1 border-grey-1',
        hint: 'referenced nowhere, delete-candidate',
    },
}
const STATUS_ORDER: UsageStatus[] = ['live', 'canonical', 'variant', 'duplicate', 'adhoc', 'showcase-only', 'dead']

function StatusChip({ status }: { status: UsageStatus }) {
    const m = STATUS_META[status] ?? STATUS_META.live
    return (
        <span
            className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${m.cls}`}
        >
            {m.label}
        </span>
    )
}

export function UsageAudit({
    eyebrow,
    title,
    intro,
    heroClass = 'bg-purple-1',
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
            {/* Hero */}
            <div className={`rounded-sm border border-n-1 p-5 ${heroClass}`}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-n-1/70">{eyebrow}</p>
                <h1 className="mt-1 text-h4">{title}</h1>
                <div className="mt-2 text-sm font-bold leading-snug text-n-1">{intro}</div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-2">
                {[
                    { label: 'inventoried', value: counts.total },
                    { label: 'live in product', value: counts.live },
                    { label: 'showcase-only', value: counts.showcase },
                    { label: 'dead', value: counts.dead },
                ].map((s) => (
                    <div key={s.label} className="rounded-sm border border-n-1 p-2 text-center">
                        <p className="text-xl font-bold">{s.value}</p>
                        <p className="text-[10px] leading-tight text-grey-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-sm border border-dashed border-grey-1 p-3">
                {STATUS_ORDER.map((s) => (
                    <span key={s} className="flex items-center gap-1.5 text-[10px] text-grey-1">
                        <StatusChip status={s} />
                        {STATUS_META[s].hint}
                    </span>
                ))}
            </div>

            {/* Filters */}
            <div className="space-y-2">
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search name / divergence / file…"
                    className="w-full rounded-sm border border-n-1 bg-white px-3 py-2 text-sm outline-none focus:border-primary-1"
                />
                <div className="flex flex-wrap gap-1">
                    {['all', ...catNames].map((c) => (
                        <button
                            key={c}
                            onClick={() => setCat(c)}
                            className={`rounded-full border border-n-1 px-2.5 py-1 text-[11px] font-bold ${
                                cat === c ? 'bg-primary-1 text-n-1' : 'bg-white text-grey-1'
                            }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-1">
                    {['all', ...STATUS_ORDER].map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatus(s)}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                                status === s ? 'border-n-1 bg-n-1 text-white' : 'border-grey-2 bg-white text-grey-1'
                            }`}
                        >
                            {s === 'all' ? 'all status' : STATUS_META[s as UsageStatus].label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grouped items */}
            {visible.map((c) => (
                <div key={c.category}>
                    <div className="mb-2 border-b border-n-1 pb-1">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold">{c.category}</h2>
                            <span className="text-[11px] text-grey-1">{c.items.length} shown</span>
                        </div>
                        {c.summary && <p className="mt-1 text-[11px] leading-snug text-grey-1">{c.summary}</p>}
                    </div>
                    <div className="space-y-2">
                        {c.items.map((i, idx) => {
                            const isDead = i.status === 'dead' || i.status === 'showcase-only'
                            return (
                                <div
                                    key={c.category + i.name + idx}
                                    className={`rounded-sm border p-3 ${
                                        isDead ? 'border-dashed border-grey-1 bg-grey-3/40' : 'border-grey-2 bg-white'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-bold leading-tight">{i.name}</p>
                                        <span
                                            className={`shrink-0 rounded-sm px-2 py-0.5 text-xs font-bold ${
                                                i.realUsages > 0 ? 'bg-n-1 text-white' : 'bg-grey-2 text-grey-1'
                                            }`}
                                        >
                                            {i.realUsages}× app
                                        </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                        <StatusChip status={i.status} />
                                        {typeof i.devUsages === 'number' && i.devUsages > 0 && (
                                            <span className="text-[10px] text-grey-1">{i.devUsages}× in /dev only</span>
                                        )}
                                        {i.verified && <span className="text-[10px] text-grey-1">✓ re-verified</span>}
                                    </div>
                                    {i.divergence && (
                                        <p className="mt-1.5 text-[11px] leading-snug text-grey-1">{i.divergence}</p>
                                    )}
                                    {i.source && (
                                        <p className="mt-1 truncate font-mono text-[10px] text-grey-1/80">{i.source}</p>
                                    )}
                                    {i.usedIn && i.usedIn.length > 0 && (
                                        <p className="mt-1 font-mono text-[10px] leading-snug text-grey-1/70">
                                            used in: {i.usedIn.slice(0, 4).join(' · ')}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}

            {footnote && (
                <div className="rounded-sm border border-dashed border-grey-1 p-3 text-[11px] leading-snug text-grey-1">
                    {footnote}
                </div>
            )}
        </DocPage>
    )
}
