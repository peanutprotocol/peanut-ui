import {
    P2P_EDGE_TYPES,
    type ExplorerFacet,
    type ExplorerNode,
    type ExplorerRelationship,
    type P2PEdgeType,
} from './types'

export type RelationshipSortKey = 'source' | 'target' | 'type' | 'count' | 'totalUsd'
export type SortDirection = 'ascending' | 'descending'

export const EDGE_TYPE_LABELS: Record<P2PEdgeType, string> = {
    SEND_LINK: 'Send link',
    REQUEST_PAYMENT: 'Request payment',
    DIRECT_TRANSFER: 'Direct transfer',
}

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
}

export interface DenseGraphRanking {
    relationshipIds: string[]
    labelNodeIds: string[]
}

export function nodeIndex(nodes: readonly ExplorerNode[]): ReadonlyMap<string, ExplorerNode> {
    return new Map(nodes.map((node) => [node.id, node]))
}

export function buildGraphNodeProjections(nodes: readonly ExplorerNode[]): GraphNodeProjection[] {
    return nodes.map((node) => ({ id: node.id, canonical: node }))
}

export function buildGraphLinkProjections(relationships: readonly ExplorerRelationship[]): GraphLinkProjection[] {
    return relationships.map((relationship) => ({
        id: relationship.id,
        source: relationship.source,
        target: relationship.target,
        canonicalRelationshipId: relationship.id,
        canonical: relationship,
    }))
}

/** Force-layout wrappers hold references only; canonical response objects stay single-owner. */
export function buildGraphProjection(
    nodes: readonly ExplorerNode[],
    relationships: readonly ExplorerRelationship[]
): { nodes: GraphNodeProjection[]; links: GraphLinkProjection[] } {
    return {
        nodes: buildGraphNodeProjections(nodes),
        links: buildGraphLinkProjections(relationships),
    }
}

/**
 * The endpoint's `bidirectional` flag is pair-level and type-agnostic: it is true
 * whenever ANY reverse row exists between the two users, so a Send-link row is
 * flagged because a Direct transfer came back. Recover the finer answer here —
 * the response carries every directed row, so no extra request is needed.
 */
export type Reciprocity = 'oneWay' | 'sameType' | 'otherType'

export const RECIPROCITY_LABELS: Record<Reciprocity, string> = {
    oneWay: 'One way',
    sameType: 'Both ways, same type',
    otherType: 'Reverse payment of another type',
}

export function reciprocityIndex(relationships: readonly ExplorerRelationship[]): ReadonlyMap<string, Reciprocity> {
    const pairs = new Set<string>()
    const typedPairs = new Set<string>()
    for (const relationship of relationships) {
        pairs.add(`${relationship.source}:${relationship.target}`)
        typedPairs.add(`${relationship.source}:${relationship.target}:${relationship.type}`)
    }
    const index = new Map<string, Reciprocity>()
    for (const relationship of relationships) {
        const reversePair = `${relationship.target}:${relationship.source}`
        if (typedPairs.has(`${reversePair}:${relationship.type}`)) index.set(relationship.id, 'sameType')
        else if (pairs.has(reversePair)) index.set(relationship.id, 'otherType')
        else index.set(relationship.id, 'oneWay')
    }
    return index
}

export function relationshipsForNode(
    relationships: readonly ExplorerRelationship[],
    nodeId: string
): ExplorerRelationship[] {
    return relationships.filter((relationship) => relationship.source === nodeId || relationship.target === nodeId)
}

function valueForSort(
    relationship: ExplorerRelationship,
    key: RelationshipSortKey,
    nodes: ReadonlyMap<string, ExplorerNode>
): string | number {
    if (key === 'source') return nodes.get(relationship.source)?.username ?? relationship.source
    if (key === 'target') return nodes.get(relationship.target)?.username ?? relationship.target
    if (key === 'count') return relationship.count
    if (key === 'totalUsd') return relationship.totalUsd
    return relationship.type
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
            if (left.totalUsd !== right.totalUsd) return right.totalUsd - left.totalUsd
            return left.id.localeCompare(right.id)
        })
        .map((relationship) => relationship.id)

    const labelNodeIds = [...nodes]
        .sort((left, right) => {
            const leftScore = weightedDegree.get(left.id) ?? 0
            const rightScore = weightedDegree.get(right.id) ?? 0
            if (leftScore !== rightScore) return rightScore - leftScore
            return left.id.localeCompare(right.id)
        })
        .slice(0, labelLimit)
        .map((node) => node.id)

    return { relationshipIds, labelNodeIds }
}

export function edgeTypesPresent(relationships: readonly ExplorerRelationship[]): P2PEdgeType[] {
    const present = new Set(relationships.map((relationship) => relationship.type))
    return P2P_EDGE_TYPES.filter((type) => present.has(type))
}

/** Facet counts are computed client-side from the unfiltered response. */
export function edgeTypeFacets(relationships: readonly ExplorerRelationship[]): ExplorerFacet[] {
    const counts = new Map<P2PEdgeType, number>()
    for (const relationship of relationships) {
        counts.set(relationship.type, (counts.get(relationship.type) ?? 0) + 1)
    }
    return P2P_EDGE_TYPES.map((type) => ({
        value: type,
        label: EDGE_TYPE_LABELS[type],
        observedCount: counts.get(type) ?? 0,
    }))
}
