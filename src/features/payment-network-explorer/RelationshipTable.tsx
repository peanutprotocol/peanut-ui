'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatUsd } from './format'
import {
    EDGE_TYPE_LABELS,
    nodeIndex,
    RECIPROCITY_LABELS,
    sortRelationships,
    type Reciprocity,
    type RelationshipSortKey,
    type SortDirection,
} from './selectors'
import type { ExplorerNode, ExplorerRelationship } from './types'

const PAGE_SIZE = 100

interface RelationshipTableProps {
    nodes: readonly ExplorerNode[]
    relationships: readonly ExplorerRelationship[]
    reciprocity: ReadonlyMap<string, Reciprocity>
    selectedId: string | null
    onSelect: (relationship: ExplorerRelationship) => void
}

export default function RelationshipTable({
    nodes,
    relationships,
    reciprocity,
    selectedId,
    onSelect,
}: RelationshipTableProps) {
    const [sortKey, setSortKey] = useState<RelationshipSortKey>('totalUsd')
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
        setSortDirection(next === 'count' || next === 'totalUsd' ? 'descending' : 'ascending')
    }

    const header = (label: string, key: RelationshipSortKey, align: 'left' | 'right' = 'left') => (
        <th
            scope="col"
            aria-sort={sortKey === key ? sortDirection : 'none'}
            className={`sticky top-0 z-10 border-b border-n-1 bg-[#fcfaf7] px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'} text-[11px] font-bold tracking-wide text-grey-1 uppercase`}
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
                    <caption className="sr-only">Payment relationships matching the selected filters</caption>
                    <thead>
                        <tr>
                            {header('From', 'source')}
                            {header('To', 'target')}
                            {header('Type', 'type')}
                            <th
                                scope="col"
                                className="sticky top-0 z-10 border-b border-n-1 bg-[#fcfaf7] px-3 py-2 text-left text-[11px] font-bold tracking-wide text-grey-1 uppercase"
                            >
                                Direction
                            </th>
                            {header('Count', 'count', 'right')}
                            {header('Total USD', 'totalUsd', 'right')}
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
                                    className={`cursor-pointer border-b border-n-1/10 outline-none hover:bg-primary-3/15 focus-visible:ring-2 focus-visible:ring-purple-1 focus-visible:ring-inset ${
                                        selected ? 'bg-primary-3/35' : ''
                                    }`}
                                >
                                    <td className="max-w-40 truncate px-3 py-2 font-semibold">
                                        {nodesById.get(relationship.source)?.username ?? relationship.source}
                                    </td>
                                    <td className="max-w-40 truncate px-3 py-2 font-semibold">
                                        {nodesById.get(relationship.target)?.username ?? relationship.target}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        {EDGE_TYPE_LABELS[relationship.type]}
                                    </td>
                                    <td
                                        className="px-3 py-2 whitespace-nowrap"
                                        title={RECIPROCITY_LABELS[reciprocity.get(relationship.id) ?? 'oneWay']}
                                    >
                                        {reciprocity.get(relationship.id) === 'sameType' ? (
                                            <span className="rounded-full border border-n-1 bg-green-1 px-1.5 py-0.5 text-[10px] font-bold">
                                                ⇄ both ways
                                            </span>
                                        ) : reciprocity.get(relationship.id) === 'otherType' ? (
                                            <span className="rounded-full border border-n-1/40 px-1.5 py-0.5 text-[10px] font-bold text-grey-1">
                                                ⇄ other type
                                            </span>
                                        ) : (
                                            <span aria-label="one way">→</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                        {relationship.count.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                        {formatUsd(relationship.totalUsd)}
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
