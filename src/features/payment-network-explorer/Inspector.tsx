'use client'

import { useMemo } from 'react'
import { formatUsd, formatUtc } from './format'
import { nodeIndex, relationshipsForNode, type Reciprocity } from './selectors'
import RelationshipDetails from './RelationshipDetails'
import type { ExplorerNode, ExplorerRelationship, ExplorerSelection } from './types'

const CONNECTION_LIMIT = 100

interface InspectorProps {
    selection: ExplorerSelection
    nodes: readonly ExplorerNode[]
    relationships: readonly ExplorerRelationship[]
    reciprocity: ReadonlyMap<string, Reciprocity>
    onSelectRelationship: (relationship: ExplorerRelationship) => void
    onClear: () => void
}

export default function Inspector({
    selection,
    nodes,
    relationships,
    reciprocity,
    onSelectRelationship,
    onClear,
}: InspectorProps) {
    const nodesById = useMemo(() => nodeIndex(nodes), [nodes])

    if (!selection) {
        return (
            <aside className="min-h-0 border-l border-n-1 bg-white p-4" aria-label="Inspector">
                <h2 className="text-sm font-bold">Inspector</h2>
                <p className="mt-3 text-xs text-grey-1">Select a node or relationship.</p>
            </aside>
        )
    }

    const heading = selection.type === 'node' ? 'Node' : 'Relationship'
    const connections = selection.type === 'node' ? relationshipsForNode(relationships, selection.node.id) : []

    return (
        <aside className="min-h-0 overflow-y-auto border-l border-n-1 bg-white p-4" aria-label={`${heading} inspector`}>
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold">{heading}</h2>
                <button type="button" onClick={onClear} className="text-xs font-semibold underline">
                    Clear
                </button>
            </div>

            {selection.type === 'node' ? (
                <>
                    <div className="rounded-sm border border-n-1 bg-[#fcfaf7] p-3">
                        <p className="break-words text-base font-bold">
                            {selection.node.username ?? selection.node.id}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-grey-1">
                            {selection.node.hasAppAccess ? 'App access' : 'No app access'}
                            {selection.node.kycRegions?.length ? ` · KYC ${selection.node.kycRegions.join(', ')}` : ''}
                        </p>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <dt className="text-grey-1">Total points</dt>
                                <dd className="font-bold tabular-nums">
                                    {selection.node.totalPoints.toLocaleString()}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-grey-1">Direct points</dt>
                                <dd className="font-bold tabular-nums">
                                    {selection.node.directPoints.toLocaleString()}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-grey-1">Signed up</dt>
                                <dd className="font-bold">
                                    {selection.node.createdAt ? formatUtc(selection.node.createdAt) : '—'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-grey-1">Last active</dt>
                                <dd className="font-bold">
                                    {selection.node.lastActiveAt ? formatUtc(selection.node.lastActiveAt) : '—'}
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <section className="mt-4" aria-labelledby="connections-heading">
                        <h3 id="connections-heading" className="text-xs font-bold uppercase tracking-wide text-grey-1">
                            Connections
                        </h3>
                        <ul className="mt-2 space-y-1">
                            {connections.slice(0, CONNECTION_LIMIT).map((relationship) => {
                                const otherId =
                                    relationship.source === selection.node.id
                                        ? relationship.target
                                        : relationship.source
                                return (
                                    <li key={relationship.id}>
                                        <button
                                            type="button"
                                            onClick={() => onSelectRelationship(relationship)}
                                            className="flex w-full items-center justify-between gap-2 rounded-sm border border-n-1/20 px-2 py-1.5 text-left text-xs hover:bg-primary-3/20"
                                        >
                                            <span className="min-w-0 truncate font-semibold">
                                                {nodesById.get(otherId)?.username ?? otherId}
                                            </span>
                                            <span className="shrink-0 text-grey-1">
                                                {relationship.count.toLocaleString()} ·{' '}
                                                {formatUsd(relationship.totalUsd)}
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                        {connections.length > CONNECTION_LIMIT && (
                            <p className="mt-2 text-[11px] text-grey-1">
                                Showing {CONNECTION_LIMIT} of {connections.length.toLocaleString()} — use the table for
                                the full list.
                            </p>
                        )}
                    </section>
                </>
            ) : (
                <RelationshipDetails
                    relationship={selection.relationship}
                    nodes={nodesById}
                    reciprocity={reciprocity.get(selection.relationship.id) ?? 'oneWay'}
                />
            )}
        </aside>
    )
}
