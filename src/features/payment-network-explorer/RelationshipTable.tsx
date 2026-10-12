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
import { Button } from '@/components/0_Bruddle/Button'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'

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
            className={`sticky top-0 z-10 border-b border-border-default bg-background-default px-3 py-1 ${align === 'right' ? 'text-right' : 'text-left'}`}
        >
            <Button
                type="button"
                variant="ghost"
                size="small"
                onClick={() => changeSort(key)}
                className={`w-auto gap-1 p-0 ${align === 'right' ? 'ml-auto' : ''}`}
            >
                {label}
                {sortKey === key && <span aria-hidden="true">{sortDirection === 'ascending' ? '↑' : '↓'}</span>}
            </Button>
        </th>
    )

    return (
        <section
            className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-background-default"
            aria-label="Relationships"
        >
            <div className="min-h-0 overflow-auto">
                <table className="w-full border-collapse text-body-xs">
                    <caption className="sr-only">Payment relationships matching the selected filters</caption>
                    <thead>
                        <tr>
                            {header('From', 'source')}
                            {header('To', 'target')}
                            {header('Type', 'type')}
                            <th
                                scope="col"
                                className="sticky top-0 z-10 border-b border-border-default bg-background-default px-3 py-2 text-left text-label-m text-foreground-secondary uppercase"
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
                                    className={`cursor-pointer border-b border-border-subtle transition-colors duration-instant outline-none hover:bg-background-disabled focus-visible:outline-[3px] focus-visible:outline-action-focus ${
                                        selected ? 'bg-action-primary/10' : ''
                                    }`}
                                >
                                    <td className="max-w-40 truncate px-3 py-2 text-label-m">
                                        {nodesById.get(relationship.source)?.username ?? relationship.source}
                                    </td>
                                    <td className="max-w-40 truncate px-3 py-2 text-label-m">
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
                                            <span className="text-label-m text-foreground-primary">⇄ both ways</span>
                                        ) : reciprocity.get(relationship.id) === 'otherType' ? (
                                            <span className="text-label-m text-foreground-secondary">⇄ other type</span>
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
                {visible.length === 0 && (
                    <div className="p-4">
                        <EmptyState icon="search" title="No relationships match" />
                    </div>
                )}
            </div>
            <nav
                className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default bg-background-default p-3 text-body-xs"
                aria-label="Table pages"
            >
                <span>
                    {sorted.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)}{' '}
                    of {sorted.length.toLocaleString()}
                </span>
                <div className="flex gap-1">
                    <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        disabled={page === 0}
                        onClick={() => setPage((value) => value - 1)}
                        className="w-auto"
                    >
                        Previous
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        size="small"
                        disabled={page + 1 >= pageCount}
                        onClick={() => setPage((value) => value + 1)}
                        className="w-auto"
                    >
                        Next
                    </Button>
                </div>
            </nav>
        </section>
    )
}
