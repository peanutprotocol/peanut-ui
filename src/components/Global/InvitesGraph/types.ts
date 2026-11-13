export interface GraphNode {
    id: string
    username: string
    hasAppAccess: boolean
    directPoints?: number
    transitivePoints?: number
    totalPoints?: number
    /** ISO date when user signed up */
    createdAt?: string
    /** ISO date of last transaction activity (null if never active or >90 days ago) */
    lastActiveAt?: string | null
    /** KYC regions: AR (Manteca Argentina), BR (Manteca Brazil), World (Bridge) - null if not KYC'd */
    kycRegions: string[] | null
    x?: number
    y?: number
}

export interface GraphEdge {
    id: string
    source: string
    target: string
    type: 'DIRECT' | 'PAYMENT_LINK'
    createdAt: string
}

/** P2P payment edge between users. The invite graph does not draw these. */
export interface P2PEdge {
    source: string
    target: string
    type: 'SEND_LINK' | 'REQUEST_PAYMENT' | 'DIRECT_TRANSFER'
    /** True if payments went both ways between these users */
    bidirectional: boolean
    count?: number
    totalUsd?: number
}

export interface GraphData {
    nodes: GraphNode[]
    edges: GraphEdge[]
    p2pEdges: P2PEdge[]
    stats: {
        totalNodes: number
        totalEdges: number
        totalP2PEdges: number
        usersWithAccess: number
        orphans: number
    }
}

export interface InvitesGraphProps {
    /** The user's invite tree, from GET /invites/user-graph */
    data: GraphData
    width?: number
    height?: number
    backgroundColor?: string
    /** Show usernames on nodes */
    showUsernames?: boolean
}

/** Display settings tracked in a ref so canvas render callbacks read fresh values without re-renders */
export type GraphDisplaySettings = {
    showUsernames: boolean
    selectedUserId: string | null
    inviterNodes: Set<string>
}
