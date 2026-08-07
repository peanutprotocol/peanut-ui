'use client'

/* eslint-disable react/jsx-no-literals -- internal team tool copy is intentionally not localized */

import { useEffect, useMemo, useState } from 'react'
import { formatRelationshipAmount, formatUtc } from './format'
import { nodeIndex, sortRelationships, type RelationshipSortKey, type SortDirection } from './selectors'
import type { ExplorerNode, ExplorerRelationship } from './types'

const PAGE_SIZE = 100

interface RelationshipTableProps {
    nodes: readonly ExplorerNode[]
    relationships: readonly ExplorerRelationship[]
    selectedId: string | null
    onSelect: (relationship: ExplorerRelationship) => void
}

export default function RelationshipTable({ nodes, relationships, selectedId, onSelect }: RelationshipTableProps) {
    const [sortKey, setSortKey] = useState<RelationshipSortKey>('lastAt')
    const [sortDirection, setSortDirection] = useState<SortDirection>('descending')
    const [page, setPage] = useState(0)
    const nodesById = useMemo(() => nodeIndex(nodes), [nodes])
    const sorted = useMemo(
        () => sortRelationships(relationships, sortKey, sortDirection, nodesById),
        [nodesById, relationships, sortDirection, sortKey]
    )
    const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
    const visible = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

    useEffect(() => setPage(0), [relationships])
    useEffect(() => {
        if (page >= pageCount) setPage(pageCount - 1)
    }, [page, pageCount])

    const changeSort = (next: RelationshipSortKey) => {
        if (next === sortKey) {
            setSortDirection((direction) => (direction === 'ascending' ? 'descending' : 'ascending'))
            return
        }
        setSortKey(next)
        setSortDirection(next === 'lastAt' || next === 'count' ? 'descending' : 'ascending')
    }

    const header = (label: string, key: RelationshipSortKey) => (
        <th
            scope="col"
            aria-sort={sortKey === key ? sortDirection : 'none'}
            className="sticky top-0 z-10 border-b border-n-1 bg-[#fcfaf7] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-grey-1"
        >
            <button
                type="button"
                onClick={() => changeSort(key)}
                className="inline-flex items-center gap-1 whitespace-nowrap"
            >
                {label}
                {sortKey === key && <span aria-hidden="true">{sortDirection === 'ascending' ? '↑' : '↓'}</span>}
            </button>
        </th>
    )

    return (
        <section className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_44px] bg-white" aria-label="Relationships">
            <div className="min-h-0 overflow-auto">
                <table className="w-full border-collapse text-xs">
                    <caption className="sr-only">Canonical payment relationships matching the selected filters</caption>
                    <thead>
                        <tr>
                            {header('Last activity', 'lastAt')}
                            {header('From', 'source')}
                            {header('To', 'target')}
                            {header('Rail', 'rail')}
                            {header('Provider', 'provider')}
                            <th
                                scope="col"
                                className="sticky top-0 z-10 border-b border-n-1 bg-[#fcfaf7] px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-grey-1"
                            >
                                Method
                            </th>
                            {header('State', 'state')}
                            {header('Count', 'count')}
                            <th
                                scope="col"
                                className="sticky top-0 z-10 border-b border-n-1 bg-[#fcfaf7] px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-grey-1"
                            >
                                Settled
                            </th>
                            <th
                                scope="col"
                                className="sticky top-0 z-10 border-b border-n-1 bg-[#fcfaf7] px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-grey-1"
                            >
                                Native amount
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((relationship) => {
                            const selected = relationship.id === selectedId
                            return (
                                <tr
                                    key={relationship.id}
                                    tabIndex={0}
                                    aria-current={selected ? 'true' : undefined}
                                    onClick={() => onSelect(relationship)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault()
                                            onSelect(relationship)
                                        }
                                    }}
                                    className={`cursor-pointer border-b border-n-1/10 outline-none hover:bg-primary-3/15 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-1 ${
                                        selected ? 'bg-primary-3/35' : ''
                                    }`}
                                >
                                    <td className="whitespace-nowrap px-3 py-2 text-grey-1">
                                        {formatUtc(relationship.lastAt)}
                                    </td>
                                    <td className="max-w-40 truncate px-3 py-2 font-semibold">
                                        {nodesById.get(relationship.source)?.label ?? relationship.source}
                                    </td>
                                    <td className="max-w-40 truncate px-3 py-2 font-semibold">
                                        {nodesById.get(relationship.target)?.label ?? relationship.target}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">
                                        {relationship.rail}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2">{relationship.provider}</td>
                                    <td className="whitespace-nowrap px-3 py-2">{relationship.method}</td>
                                    <td className="px-3 py-2">
                                        <span
                                            className={`rounded-full border border-n-1 px-1.5 py-0.5 text-[10px] font-bold ${
                                                relationship.state === 'SETTLED' ? 'bg-green-1' : 'bg-yellow-1'
                                            }`}
                                        >
                                            {relationship.state}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                        {relationship.count.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                        {relationship.settledPaymentCount.toLocaleString()}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[11px]">
                                        {formatRelationshipAmount(relationship)}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
                {visible.length === 0 && <p className="p-8 text-center text-sm text-grey-1">No relationships match.</p>}
            </div>
            <nav
                className="flex items-center justify-between border-t border-n-1 bg-[#fcfaf7] px-3 text-xs"
                aria-label="Table pages"
            >
                <span>
                    {sorted.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)}{' '}
                    of {sorted.length.toLocaleString()}
                </span>
                <div className="flex gap-1">
                    <button
                        type="button"
                        disabled={page === 0}
                        onClick={() => setPage((value) => value - 1)}
                        className="rounded-sm border border-n-1 bg-white px-2 py-1 font-semibold disabled:opacity-35"
                    >
                        Previous
                    </button>
                    <button
                        type="button"
                        disabled={page + 1 >= pageCount}
                        onClick={() => setPage((value) => value + 1)}
                        className="rounded-sm border border-n-1 bg-white px-2 py-1 font-semibold disabled:opacity-35"
                    >
                        Next
                    </button>
                </div>
            </nav>
        </section>
    )
}
