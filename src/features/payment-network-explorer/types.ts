export const P2P_EDGE_TYPES = ['SEND_LINK', 'REQUEST_PAYMENT', 'DIRECT_TRANSFER'] as const
export type P2PEdgeType = (typeof P2P_EDGE_TYPES)[number]

export const EDGE_DIRECTION_FILTERS = ['all', 'oneWay', 'bidirectional'] as const
export type EdgeDirectionFilter = (typeof EDGE_DIRECTION_FILTERS)[number]

export type ExplorerView = 'graph' | 'table'

/** GET /invites/graph?mode=full — deployed contract (peanut-api-ts src/routes/invite.ts). */
export interface ExplorerNode {
    id: string
    /** Nullable in the DB (users.username String?) and serialized verbatim. */
    username: string | null
    hasAppAccess: boolean
    directPoints: number
    transitivePoints: number
    totalPoints: number
    createdAt: string | null
    lastActiveAt: string | null
    kycRegions: string[] | null
}

export interface InviteEdge {
    id: string
    source: string
    target: string
    type: 'DIRECT' | 'PAYMENT_LINK'
    createdAt: string
}

/** Pre-aggregated per directed user pair; hardcoded 120-day COMPLETED-only window. */
export interface P2PEdge {
    source: string
    target: string
    type: P2PEdgeType
    count: number
    totalUsd: number
    bidirectional: boolean
}

export interface ExplorerStats {
    totalNodes: number
    totalEdges: number
    totalP2PEdges: number
    usersWithAccess: number
    orphans: number
}

export interface ExplorerGraphResponse {
    nodes: ExplorerNode[]
    edges: InviteEdge[]
    p2pEdges: P2PEdge[]
    stats: ExplorerStats
}

/** A p2p edge with a synthesized stable id for selection and sorting. */
export interface ExplorerRelationship extends P2PEdge {
    id: string
}

export interface ExplorerFilters {
    view: ExplorerView
    types: P2PEdgeType[]
    direction: EdgeDirectionFilter
    minCount: number
    minUsd: number
    topNodes: number
    focus: string | null
}

export interface ExplorerFacet {
    value: string
    label: string
    observedCount: number
}

export type ExplorerSelection =
    | { type: 'node'; node: ExplorerNode }
    | { type: 'relationship'; relationship: ExplorerRelationship }
    | null
