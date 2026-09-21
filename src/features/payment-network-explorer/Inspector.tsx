'use client'

import { useMemo } from 'react'
import { formatUsd, formatUtc } from './format'
import { nodeIndex, relationshipsForNode, type Reciprocity } from './selectors'
import RelationshipDetails from './RelationshipDetails'
import type { ExplorerNode, ExplorerRelationship, ExplorerSelection } from './types'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'

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
            <aside
                className="min-h-0 border-t border-border-default bg-background-default p-4 lg:border-t-0 lg:border-l"
                aria-label="Inspector"
            >
                <EmptyState icon="search" title="Inspector" description="Select a node or relationship." />
            </aside>
        )
    }

    const heading = selection.type === 'node' ? 'Node' : 'Relationship'
    const connections = selection.type === 'node' ? relationshipsForNode(relationships, selection.node.id) : []

    return (
        <aside
            className="min-h-0 overflow-y-auto border-t border-border-default bg-background-default p-4 lg:border-t-0 lg:border-l"
            aria-label={`${heading} inspector`}
        >
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-heading-card">{heading}</h2>
                <LinkButton onClick={onClear}>Clear</LinkButton>
            </div>

            {selection.type === 'node' ? (
                <>
                    <Card className="divide-y divide-dashed divide-border-default p-4">
                        <TitleBlock
                            className="pb-2"
                            title={selection.node.username ?? selection.node.id}
                            description={`${selection.node.hasAppAccess ? 'App access' : 'No app access'}${
                                selection.node.kycRegions?.length
                                    ? ` · KYC ${selection.node.kycRegions.join(', ')}`
                                    : ''
                            }`}
                        />
                        <DataRow label="Total points" value={selection.node.totalPoints.toLocaleString()} />
                        <DataRow label="Direct points" value={selection.node.directPoints.toLocaleString()} />
                        <DataRow
                            label="Signed up"
                            value={selection.node.createdAt ? formatUtc(selection.node.createdAt) : '—'}
                        />
                        <DataRow
                            label="Last active"
                            value={selection.node.lastActiveAt ? formatUtc(selection.node.lastActiveAt) : '—'}
                        />
                    </Card>

                    <section className="mt-4" aria-labelledby="connections-heading">
                        <h3 id="connections-heading" className="text-label-m text-foreground-secondary uppercase">
                            Connections
                        </h3>
                        <ListGroup className="mt-2">
                            {connections.slice(0, CONNECTION_LIMIT).map((relationship) => {
                                const outgoing = relationship.source === selection.node.id
                                const otherId = outgoing ? relationship.target : relationship.source
                                return (
                                    <ListItem
                                        key={relationship.id}
                                        onClick={() => onSelectRelationship(relationship)}
                                        title={nodesById.get(otherId)?.username ?? otherId}
                                        body={outgoing ? 'Sent to' : 'Received from'}
                                        trailing={
                                            <span className="text-body-xs text-foreground-secondary">
                                                {relationship.count.toLocaleString()} ·{' '}
                                                {formatUsd(relationship.totalUsd)}
                                            </span>
                                        }
                                    />
                                )
                            })}
                        </ListGroup>
                        {connections.length > CONNECTION_LIMIT && (
                            <p className="mt-2 text-body-xs text-foreground-secondary">
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
