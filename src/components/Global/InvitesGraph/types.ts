import {
    type ExternalNode,
    type ExternalNodeType,
    type SizeLabel,
    type FrequencyLabel,
    type VolumeLabel,
} from '@/services/points'

// Types
export interface GraphNode {
    id: string
    username: string
    hasAppAccess: boolean
    // Full mode fields - optional in payment mode
    directPoints?: number
    transitivePoints?: number
    totalPoints?: number
    /** ISO date when user signed up */
    createdAt?: string
    /** ISO date of last transaction activity (null if never active or >90 days ago) */
    lastActiveAt?: string | null
    // Payment mode fields - optional in full mode
    size?: SizeLabel
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

/** P2P payment edge between users (for clustering)
 * Supports both full mode (with exact count/totalUsd) and anonymized mode (with frequency/volume labels)
 */
export interface P2PEdge {
    source: string
    target: string
    type: 'SEND_LINK' | 'REQUEST_PAYMENT' | 'DIRECT_TRANSFER'
    /** True if payments went both ways between these users */
    bidirectional: boolean
    // Full mode fields (exact values)
    count?: number
    totalUsd?: number
    // Anonymized mode fields (qualitative labels)
    frequency?: FrequencyLabel
    volume?: VolumeLabel
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

/** Activity filter options for visualizing user engagement */
export type ActivityFilter = {
    /** Number of days for activity window (signup OR last tx within this period = active) */
    activityDays: number
    /** Whether the activity filter is enabled */
    enabled: boolean
    /** Whether to hide (not render) inactive users vs just grey them out */
    hideInactive: boolean
}

/**
 * Force configuration for fine-tuning graph layout
 *
 * NOTE: Changing these values triggers FULL FORCE RECALCULATION (expensive)
 * Use VisibilityConfig to hide/show elements without recalculating
 */
export type ForceConfig = {
    /** Node repulsion (charge) - prevents overlap */
    charge: { enabled: boolean; strength: number }
    /** Invite link attraction - tree clustering (force only, use visibilityConfig to hide edges) */
    inviteLinks: { enabled: boolean; strength: number; distance?: number }
    /** P2P link attraction - clusters transacting users (force only, use visibilityConfig to hide edges) */
    p2pLinks: { enabled: boolean; strength: number }
    /** External link attraction - clusters users with shared wallets/banks/merchants */
    externalLinks: { enabled: boolean; strength: number }
    /** Center gravity - keeps graph together. sizeBias: 0=uniform, 1=big nodes 2x stronger pull */
    center: { enabled: boolean; strength: number; sizeBias: number }
}

/**
 * Visibility configuration - what data is included in graph
 *
 * NOTE: Changing these values REMOVES data from simulation (triggers recalculation)
 * This is different from visual-only settings like colors/labels
 * Toggling takes 2-3 seconds but gives accurate layout and better performance
 */
export type VisibilityConfig = {
    /** Include invite edges (DIRECT and PAYMENT_LINK) in graph data */
    inviteEdges: boolean
    /** Include P2P payment edges in graph data */
    p2pEdges: boolean
    /** Include active nodes in graph data */
    activeNodes: boolean
    /** Include inactive nodes in graph data */
    inactiveNodes: boolean
}

/** Configuration for external nodes (wallets, banks, merchants) */
export type ExternalNodesConfig = {
    /** Whether to show external nodes */
    enabled: boolean
    /** Minimum number of unique users to show an external node */
    minConnections: number
    /** Maximum number of external nodes to fetch from API (default: 5000, max: 10000) */
    limit: number
    /** Which types to show */
    types: {
        WALLET: boolean
        BANK: boolean
        MERCHANT: boolean
    }
}

// Constants
export const DEFAULT_FORCE_CONFIG: ForceConfig = {
    charge: { enabled: true, strength: 80 },
    inviteLinks: { enabled: true, strength: 0.4 },
    p2pLinks: { enabled: true, strength: 0.3 },
    externalLinks: { enabled: true, strength: 0.2 }, // Weaker than P2P - external connections are looser
    center: { enabled: true, strength: 0.03, sizeBias: 0.5 },
}

export const DEFAULT_VISIBILITY_CONFIG: VisibilityConfig = {
    inviteEdges: true,
    p2pEdges: true,
    activeNodes: true,
    inactiveNodes: true,
}

export const DEFAULT_EXTERNAL_NODES_CONFIG: ExternalNodesConfig = {
    enabled: false,
    minConnections: 2,
    limit: 5000, // Default limit for API query (can increase up to 10k)
    types: {
        WALLET: false, // Disabled by default (too many, less useful for analysis)
        BANK: true,
        MERCHANT: true,
    },
}

// Default activity filter - enabled by default with 30d window
export const DEFAULT_ACTIVITY_FILTER: ActivityFilter = {
    activityDays: 30,
    enabled: true,
    hideInactive: false, // Default: show inactive as greyed out
}

/** Re-export types from points service for convenience */
export type { ExternalNode, ExternalNodeType, SizeLabel, FrequencyLabel, VolumeLabel }
