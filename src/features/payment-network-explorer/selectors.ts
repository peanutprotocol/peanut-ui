import { MOVEMENT_STATES, type ExplorerNode, type ExplorerRelationship, type ExplorerSampling } from './types'

export type RelationshipSortKey = 'lastAt' | 'source' | 'target' | 'rail' | 'provider' | 'count' | 'state'
export type SortDirection = 'ascending' | 'descending'

export interface GraphNodeProjection {
    id: string
    canonical: ExplorerNode
    x?: number
    y?: number
}

export interface GraphLinkProjection {
    id: string
    source: string
    target: string
    canonicalRelationshipId: string
    canonical: ExplorerRelationship
    segment: 'direct' | 'source-to-hub' | 'hub-to-target'
}

export interface DenseGraphRanking {
    relationshipIds: string[]
    labelNodeIds: string[]
}

export function nodeIndex(nodes: readonly ExplorerNode[]): ReadonlyMap<string, ExplorerNode> {
    return new Map(nodes.map((node) => [node.id, node]))
}

/** Force-layout wrappers hold references only; canonical response objects stay single-owner. */
export function buildGraphProjection(
    nodes: readonly ExplorerNode[],
    relationships: readonly ExplorerRelationship[]
): { nodes: GraphNodeProjection[]; links: GraphLinkProjection[] } {
    return {
        nodes: nodes.map((node) => ({ id: node.id, canonical: node })),
        links: relationships.flatMap<GraphLinkProjection>((relationship) =>
            relationship.infrastructureHubId
                ? [
                      {
                          id: `${relationship.id}:source-to-hub`,
                          source: relationship.source,
                          target: relationship.infrastructureHubId,
                          canonicalRelationshipId: relationship.id,
                          canonical: relationship,
                          segment: 'source-to-hub',
                      },
                      {
                          id: `${relationship.id}:hub-to-target`,
                          source: relationship.infrastructureHubId,
                          target: relationship.target,
                          canonicalRelationshipId: relationship.id,
                          canonical: relationship,
                          segment: 'hub-to-target',
                      },
                  ]
                : [
                      {
                          id: relationship.id,
                          source: relationship.source,
                          target: relationship.target,
                          canonicalRelationshipId: relationship.id,
                          canonical: relationship,
                          segment: 'direct',
                      },
                  ]
        ),
    }
}

export function relationshipsForNode(
    relationships: readonly ExplorerRelationship[],
    nodeId: string
): ExplorerRelationship[] {
    return relationships.filter((relationship) => relationship.source === nodeId || relationship.target === nodeId)
}

export function relationshipIds(relationships: readonly ExplorerRelationship[]): string[] {
    return relationships.map((relationship) => relationship.id)
}

function valueForSort(
    relationship: ExplorerRelationship,
    key: RelationshipSortKey,
    nodes: ReadonlyMap<string, ExplorerNode>
): string | number {
    if (key === 'source') return nodes.get(relationship.source)?.label ?? relationship.source
    if (key === 'target') return nodes.get(relationship.target)?.label ?? relationship.target
    if (key === 'count') return relationship.count
    return relationship[key]
}

export function sortRelationships(
    relationships: readonly ExplorerRelationship[],
    key: RelationshipSortKey,
    direction: SortDirection,
    nodes: ReadonlyMap<string, ExplorerNode>
): ExplorerRelationship[] {
    const multiplier = direction === 'ascending' ? 1 : -1
    return [...relationships].sort((left, right) => {
        const a = valueForSort(left, key, nodes)
        const b = valueForSort(right, key, nodes)
        if (typeof a === 'number' && typeof b === 'number') return (a - b) * multiplier
        return String(a).localeCompare(String(b)) * multiplier
    })
}

export function graphTableRelationshipParity(
    links: readonly GraphLinkProjection[],
    tableRelationships: readonly ExplorerRelationship[]
): boolean {
    const graphIds = Array.from(new Set(links.map((link) => link.canonicalRelationshipId))).sort()
    const tableIds = relationshipIds(tableRelationships).sort()
    return graphIds.length === tableIds.length && graphIds.every((id, index) => id === tableIds[index])
}

/**
 * Ranks a dense graph's canonical objects for overview rendering. This only
 * changes canvas visibility: every relationship remains in graphData and the
 * relationship table, so selection and exact counts stay canonical.
 */
export function rankDenseGraphOverview(
    nodes: readonly ExplorerNode[],
    relationships: readonly ExplorerRelationship[],
    labelLimit = 12
): DenseGraphRanking {
    const weightedDegree = new Map<string, number>()
    for (const relationship of relationships) {
        const weight = Math.max(1, relationship.count)
        weightedDegree.set(relationship.source, (weightedDegree.get(relationship.source) ?? 0) + weight)
        weightedDegree.set(relationship.target, (weightedDegree.get(relationship.target) ?? 0) + weight)
    }

    const relationshipIds = [...relationships]
        .sort((left, right) => {
            const leftEndpointActivity = (weightedDegree.get(left.source) ?? 0) + (weightedDegree.get(left.target) ?? 0)
            const rightEndpointActivity =
                (weightedDegree.get(right.source) ?? 0) + (weightedDegree.get(right.target) ?? 0)
            const leftScore = Math.max(1, left.count) * (1 + Math.log2(leftEndpointActivity + 1))
            const rightScore = Math.max(1, right.count) * (1 + Math.log2(rightEndpointActivity + 1))
            if (leftScore !== rightScore) return rightScore - leftScore
            if (left.lastAt !== right.lastAt) return right.lastAt.localeCompare(left.lastAt)
            return left.id.localeCompare(right.id)
        })
        .map((relationship) => relationship.id)

    const labelNodeIds = [...nodes]
        .sort((left, right) => {
            const leftScore = (weightedDegree.get(left.id) ?? 0) + Math.max(0, left.paymentCount)
            const rightScore = (weightedDegree.get(right.id) ?? 0) + Math.max(0, right.paymentCount)
            if (leftScore !== rightScore) return rightScore - leftScore
            return left.id.localeCompare(right.id)
        })
        .slice(0, labelLimit)
        .map((node) => node.id)

    return { relationshipIds, labelNodeIds }
}

export function movementStatesPresent(relationships: readonly ExplorerRelationship[]) {
    const present = new Set(relationships.map((relationship) => relationship.state))
    return MOVEMENT_STATES.filter((state) => present.has(state))
}

export function settledEventCoveragePercent(sampling: ExplorerSampling): number {
    if (sampling.matchedSettledEventCount <= 0) return 0
    return Math.min(
        100,
        Math.max(0, Math.round((sampling.returnedSettledEventCount / sampling.matchedSettledEventCount) * 100))
    )
}

export function missingPrincipalMovementCount(missingPrincipal: readonly { count: number }[]): number {
    return missingPrincipal.reduce((total, group) => total + Math.max(0, group.count), 0)
}
