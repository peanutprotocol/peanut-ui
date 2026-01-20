'use client'

/**
 * InvitesGraph - Interactive force-directed graph visualization
 *
 * ARCHITECTURE: Visual Settings vs Data Settings
 *
 * VISUAL ONLY (no recalculation, instant):
 *   - showUsernames: Show/hide labels
 *   - activityFilter.activityDays: Change activity threshold (affects coloring)
 *
 * DATA FILTERING (triggers recalculation, 2-3 sec):
 *   - forceConfig: Change force strengths
 *   - visibilityConfig: Remove nodes/edges from simulation
 *     - activeNodes / inactiveNodes: Filter by activity status
 *     - inviteEdges / p2pEdges: Filter edge types
 *   - showAllNodes: Toggle 5000 node limit
 *   - externalNodesConfig: Add/remove external nodes
 *
 * REINSERTION STRATEGY (when toggling nodes/edges back ON):
 *   1. Nodes are added back to simulation with no fixed positions
 *   2. D3 force simulation calculates initial positions based on forces
 *   3. Nodes naturally settle near connected neighbors (2-3 seconds)
 *   4. No blocking warmup - smooth visual transition as they move into place
 *   5. Layout adapts to current graph state (better than cached positions)
 *
 * KEY FUNCTIONS:
 *   - handleResetView(): Clear selection + zoom out (keeps settings)
 *   - handleReset(): Reset all settings to defaults + zoom out
 *   - handleRecalculate(): Force full recalculation with current settings
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { pointsApi, type ExternalNode, type ExternalNodeType } from '@/services/points'
import { inferBankAccountType } from '@/utils/bridge.utils'
import { useGraphPreferences } from '@/hooks/useGraphPreferences'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
}) as any

// Constants for drag vs click detection
const CLICK_MAX_DURATION_MS = 200
const CLICK_MAX_DISTANCE_PX = 5

// Types
export interface GraphNode {
    id: string
    username: string
    hasAppAccess: boolean
    directPoints: number
    transitivePoints: number
    totalPoints: number
    /** ISO date when user signed up */
    createdAt: string
    /** ISO date of last transaction activity (null if never active or >90 days ago) */
    lastActiveAt: string | null
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

/** P2P payment edge between users (for clustering) */
export interface P2PEdge {
    source: string
    target: string
    type: 'SEND_LINK' | 'REQUEST_PAYMENT' | 'DIRECT_TRANSFER'
    count: number
    totalUsd: number
    /** True if payments went both ways between these users */
    bidirectional: boolean
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
    inviteLinks: { enabled: boolean; strength: number }
    /** P2P link attraction - clusters transacting users (force only, use visibilityConfig to hide edges) */
    p2pLinks: { enabled: boolean; strength: number }
    /** External link attraction - clusters users with shared wallets/banks/merchants */
    externalLinks: { enabled: boolean; strength: number }
    /** Center gravity - keeps graph together. sizeBias: 0=uniform, 1=big nodes 2x stronger pull */
    center: { enabled: boolean; strength: number; sizeBias: number }
}

export const DEFAULT_FORCE_CONFIG: ForceConfig = {
    charge: { enabled: true, strength: 80 },
    inviteLinks: { enabled: true, strength: 0.4 },
    p2pLinks: { enabled: true, strength: 0.3 },
    externalLinks: { enabled: true, strength: 0.2 }, // Weaker than P2P - external connections are looser
    center: { enabled: true, strength: 0.03, sizeBias: 0.5 },
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

export const DEFAULT_VISIBILITY_CONFIG: VisibilityConfig = {
    inviteEdges: true,
    p2pEdges: true,
    activeNodes: true,
    inactiveNodes: true,
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

/** Re-export ExternalNode type for convenience */
export type { ExternalNode, ExternalNodeType }

interface BaseProps {
    width?: number
    height?: number
    backgroundColor?: string
    /** Show usernames on nodes */
    showUsernames?: boolean
    /** Show all nodes (no 5000 limit) - can be slow */
    showAllNodes?: boolean
    /** Activity filter for highlighting active/inactive/new users */
    activityFilter?: ActivityFilter
    /** Force configuration for layout tuning */
    forceConfig?: ForceConfig
    /** Visibility configuration for toggling element rendering */
    visibilityConfig?: VisibilityConfig
    /** Render prop for additional overlays */
    renderOverlays?: (props: {
        showUsernames: boolean
        setShowUsernames: (v: boolean) => void
        showAllNodes: boolean
        setShowAllNodes: (v: boolean) => void
        activityFilter: ActivityFilter
        setActivityFilter: (v: ActivityFilter) => void
        forceConfig: ForceConfig
        setForceConfig: (v: ForceConfig) => void
        visibilityConfig: VisibilityConfig
        setVisibilityConfig: (v: VisibilityConfig) => void
        externalNodesConfig: ExternalNodesConfig
        setExternalNodesConfig: (v: ExternalNodesConfig) => void
        externalNodes: ExternalNode[]
        externalNodesLoading: boolean
        externalNodesError: string | null
        handleResetView: () => void
        handleReset: () => void
        handleRecalculate: () => void
    }) => React.ReactNode
}

interface FullModeProps extends BaseProps {
    /** Admin API key to fetch full graph */
    apiKey: string
    /** Close/back button handler */
    onClose?: () => void
    /** Minimal mode disabled */
    minimal?: false
    data?: never
}

interface MinimalModeProps extends BaseProps {
    /** Graph data passed directly */
    data: GraphData
    /** Minimal mode - just the graph canvas, no controls */
    minimal: true
    apiKey?: never
    onClose?: never
}

type InvitesGraphProps = FullModeProps | MinimalModeProps

// Hook for graph data pass-through (kept for backward compatibility)
// Note: Previously filtered tree data, now just returns graph data unchanged
// selectedUserId is only used for camera positioning and highlighting in rendering
function useGraphFiltering(graphData: GraphData | null) {
    return graphData
}

// Default activity filter - enabled by default with 30d window
export const DEFAULT_ACTIVITY_FILTER: ActivityFilter = {
    activityDays: 30,
    enabled: true,
    hideInactive: false, // Default: show inactive as greyed out
}

// Performance limit - max nodes to render
const MAX_NODES = 5000

/**
 * Prune graph to MAX_NODES by removing oldest inactive users first
 * Keeps all edges between remaining nodes
 */
function pruneGraphData(graphData: GraphData | null): GraphData | null {
    if (!graphData || graphData.nodes.length <= MAX_NODES) {
        return graphData
    }

    // Sort nodes: active users first (by lastActiveAt desc), then inactive (by createdAt desc)
    const sortedNodes = [...graphData.nodes].sort((a, b) => {
        // Both have lastActiveAt - sort by most recent first
        if (a.lastActiveAt && b.lastActiveAt) {
            return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
        }
        // Only a has activity - a comes first
        if (a.lastActiveAt && !b.lastActiveAt) return -1
        // Only b has activity - b comes first
        if (!a.lastActiveAt && b.lastActiveAt) return 1
        // Neither has activity - sort by createdAt (most recent first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    // Take top MAX_NODES
    const keptNodes = sortedNodes.slice(0, MAX_NODES)
    const keptNodeIds = new Set(keptNodes.map((n) => n.id))

    // Filter edges to only include those between kept nodes
    const keptEdges = graphData.edges.filter((edge) => keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target))

    // Filter P2P edges to only include those between kept nodes
    const keptP2PEdges = (graphData.p2pEdges || []).filter(
        (edge) => keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target)
    )

    return {
        nodes: keptNodes,
        edges: keptEdges,
        p2pEdges: keptP2PEdges,
        stats: {
            totalNodes: keptNodes.length,
            totalEdges: keptEdges.length,
            totalP2PEdges: keptP2PEdges.length,
            usersWithAccess: keptNodes.filter((n) => n.hasAppAccess).length,
            orphans: keptNodes.filter((n) => !n.hasAppAccess).length,
        },
    }
}

export default function InvitesGraph(props: InvitesGraphProps) {
    const {
        width,
        height,
        backgroundColor = '#f9fafb',
        showUsernames: initialShowUsernames = true,
        showAllNodes: initialShowAllNodes = false,
        activityFilter: initialActivityFilter = DEFAULT_ACTIVITY_FILTER,
        forceConfig: initialForceConfig = DEFAULT_FORCE_CONFIG,
        visibilityConfig: initialVisibilityConfig = DEFAULT_VISIBILITY_CONFIG,
        renderOverlays,
    } = props

    const isMinimal = props.minimal === true

    // Data state
    const [fetchedGraphData, setFetchedGraphData] = useState<GraphData | null>(null)
    const [loading, setLoading] = useState(!isMinimal)
    const [error, setError] = useState<string | null>(null)

    // UI state (declare early so they can be used in data processing)
    const [showUsernames, setShowUsernames] = useState(initialShowUsernames)
    const [showAllNodes, setShowAllNodes] = useState(initialShowAllNodes)

    // Use passed data in minimal mode, fetched data otherwise
    const rawGraphData = isMinimal ? props.data : fetchedGraphData

    // Prune to MAX_NODES for performance (keeps most active users) unless showAllNodes is enabled
    const prunedGraphData = useMemo(() => {
        if (showAllNodes) return rawGraphData
        return pruneGraphData(rawGraphData)
    }, [rawGraphData, showAllNodes])

    // Helper to check if node is active based on activityDays threshold
    // Used for both coloring and visibility filtering
    const isNodeActive = useCallback((node: GraphNode, filter: ActivityFilter): boolean => {
        const now = Date.now()
        const activityCutoff = now - filter.activityDays * 24 * 60 * 60 * 1000

        // Active if signed up recently
        const createdAtMs = node.createdAt ? new Date(node.createdAt).getTime() : 0
        if (createdAtMs >= activityCutoff) return true

        // Active if had recent tx
        if (node.lastActiveAt) {
            const lastActiveMs = new Date(node.lastActiveAt).getTime()
            if (lastActiveMs >= activityCutoff) return true
        }

        return false
    }, [])
    const [activityFilter, setActivityFilter] = useState<ActivityFilter>(initialActivityFilter)
    const [forceConfig, setForceConfig] = useState<ForceConfig>(initialForceConfig)
    const [visibilityConfig, setVisibilityConfig] = useState<VisibilityConfig>(initialVisibilityConfig)
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<GraphNode[]>([])

    // External nodes state (wallets, banks, merchants)
    const [externalNodesConfig, setExternalNodesConfig] = useState<ExternalNodesConfig>(DEFAULT_EXTERNAL_NODES_CONFIG)
    const [externalNodesData, setExternalNodesData] = useState<ExternalNode[]>([])
    const [externalNodesLoading, setExternalNodesLoading] = useState(false)
    const [externalNodesError, setExternalNodesError] = useState<string | null>(null)
    const externalNodesFetchedRef = useRef(false) // Track if we've fetched (don't refetch on toggle off/on)

    // Graph preferences persistence
    const { preferences, savePreferences, isLoaded: preferencesLoaded } = useGraphPreferences()
    const preferencesRestoredRef = useRef(false)

    // Load preferences ONCE on mount (only in full mode)
    // Using preferencesLoaded as the only dependency - preferences won't change after load
    useEffect(() => {
        if (isMinimal || !preferencesLoaded || preferencesRestoredRef.current) return

        // Mark as restored immediately to prevent any re-runs
        preferencesRestoredRef.current = true

        if (!preferences) return

        // Migrate old preferences: agePositioning, centerGravity, sizeBasedCenter → center
        // CRITICAL: Merge with defaults to ensure all fields exist
        let migratedForceConfig = preferences.forceConfig as any
        if (migratedForceConfig) {
            // Migrate old fields to new unified center force
            const hasOldCenterGravity = 'centerGravity' in migratedForceConfig
            const hasOldSizeBasedCenter = 'sizeBasedCenter' in migratedForceConfig
            const hasOldAgePositioning = 'agePositioning' in migratedForceConfig

            if (hasOldCenterGravity || hasOldSizeBasedCenter || hasOldAgePositioning) {
                // Remove old fields and create new unified center
                const { centerGravity, sizeBasedCenter, agePositioning, ...rest } = migratedForceConfig

                // Use old centerGravity strength if available, otherwise sizeBasedCenter, otherwise default
                const oldStrength =
                    centerGravity?.strength ?? sizeBasedCenter?.strength ?? DEFAULT_FORCE_CONFIG.center.strength

                migratedForceConfig = {
                    ...rest,
                    center: {
                        enabled: centerGravity?.enabled ?? sizeBasedCenter?.enabled ?? true,
                        strength: oldStrength,
                        sizeBias: sizeBasedCenter?.enabled ? 0.5 : 0, // If old sizeBased was on, keep some bias
                    },
                }
                console.log('Migrated old center forces to unified center')
            }

            // Merge with defaults to fill in any missing fields
            migratedForceConfig = {
                ...DEFAULT_FORCE_CONFIG,
                ...migratedForceConfig,
            }
        }

        // Restore saved preferences
        if (migratedForceConfig) setForceConfig(migratedForceConfig)
        if (preferences.visibilityConfig) setVisibilityConfig(preferences.visibilityConfig)
        if (preferences.activityFilter) setActivityFilter(preferences.activityFilter)
        if (preferences.externalNodesConfig) setExternalNodesConfig(preferences.externalNodesConfig)
        if (preferences.showUsernames !== undefined) setShowUsernames(preferences.showUsernames)
        if (preferences.showAllNodes !== undefined) setShowAllNodes(preferences.showAllNodes)

        console.log('Restored graph preferences (migrated):', preferences)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preferencesLoaded, isMinimal]) // Only depend on preferencesLoaded, not preferences

    // Auto-save preferences when they change (debounced to avoid excessive writes)
    // Skip saving until preferences have been restored to avoid overwriting with defaults
    useEffect(() => {
        if (isMinimal || !preferencesRestoredRef.current) return

        const timeout = setTimeout(() => {
            savePreferences({
                forceConfig,
                visibilityConfig,
                activityFilter,
                externalNodesConfig,
                showUsernames,
                showAllNodes,
            })
        }, 1000) // Debounce 1 second

        return () => clearTimeout(timeout)
    }, [
        forceConfig,
        visibilityConfig,
        activityFilter,
        externalNodesConfig,
        showUsernames,
        showAllNodes,
        isMinimal,
        savePreferences,
    ])

    // Filter nodes/edges based on visibility settings (DELETE approach)
    // All visibility toggles remove data from simulation for better performance and accurate layout
    const graphData = useMemo(() => {
        if (!prunedGraphData) return null

        // Start with all nodes
        let filteredNodes = prunedGraphData.nodes

        // Filter by Active/Inactive visibility checkboxes
        // Uses activityDays (default 30) to determine what's "active"
        if (!visibilityConfig.activeNodes || !visibilityConfig.inactiveNodes) {
            filteredNodes = filteredNodes.filter((node) => {
                const isActive = isNodeActive(node, activityFilter)
                if (isActive && !visibilityConfig.activeNodes) return false
                if (!isActive && !visibilityConfig.inactiveNodes) return false
                return true
            })
        }

        const nodeIds = new Set(filteredNodes.map((n) => n.id))

        // Filter edges based on visibility settings AND whether both nodes exist
        let filteredEdges = prunedGraphData.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        if (!visibilityConfig.inviteEdges) {
            filteredEdges = []
        }

        let filteredP2PEdges = (prunedGraphData.p2pEdges || []).filter(
            (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
        )
        if (!visibilityConfig.p2pEdges) {
            filteredP2PEdges = []
        }

        return {
            nodes: filteredNodes,
            edges: filteredEdges,
            p2pEdges: filteredP2PEdges,
            stats: {
                totalNodes: filteredNodes.length,
                totalEdges: filteredEdges.length,
                totalP2PEdges: filteredP2PEdges.length,
                usersWithAccess: filteredNodes.filter((n) => n.hasAppAccess).length,
                orphans: filteredNodes.filter((n) => !n.hasAppAccess).length,
            },
        }
    }, [prunedGraphData, activityFilter.activityDays, visibilityConfig, isNodeActive])

    const graphRef = useRef<any>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const forcesConfiguredRef = useRef(false)
    const initialZoomDoneRef = useRef(false)
    const [containerWidth, setContainerWidth] = useState<number | null>(null)

    // Drag vs click detection
    const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
    const isDraggingRef = useRef(false)

    // Measure container width for minimal mode
    useEffect(() => {
        if (!isMinimal || !containerRef.current) return

        const measureWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth)
            }
        }

        measureWidth()
        window.addEventListener('resize', measureWidth)
        return () => window.removeEventListener('resize', measureWidth)
    }, [isMinimal])

    // Selection only affects camera positioning, not data
    // Always use the activity/visibility filtered data
    const filteredGraphData = useGraphFiltering(graphData)

    // Clear selection if selected node is filtered out
    useEffect(() => {
        if (selectedUserId && filteredGraphData) {
            const nodeExists = filteredGraphData.nodes.some((n) => n.id === selectedUserId)
            if (!nodeExists) {
                setSelectedUserId(null)
            }
        }
    }, [selectedUserId, filteredGraphData])

    // Build map of nodeId → inviter username for tooltips
    const inviterMap = useMemo(() => {
        if (!filteredGraphData) return new Map<string, string>()
        const map = new Map<string, string>()
        const nodeMap = new Map(filteredGraphData.nodes.map((n) => [n.id, n.username]))
        filteredGraphData.edges.forEach((edge) => {
            // edge.source = inviter, edge.target = invitee
            const inviterUsername = nodeMap.get(edge.source)
            if (inviterUsername) {
                map.set(edge.target, inviterUsername)
            }
        })
        return map
    }, [filteredGraphData])

    // Filter external nodes based on config (client-side for fast UI updates)
    const filteredExternalNodes = useMemo(() => {
        if (!externalNodesConfig.enabled) return []

        return externalNodesData.filter((node) => {
            // Filter by minConnections
            if (node.uniqueUsers < externalNodesConfig.minConnections) return false
            // Filter by type
            if (!externalNodesConfig.types[node.type]) return false
            return true
        })
    }, [externalNodesData, externalNodesConfig])

    // Build combined graph nodes including external nodes
    // External nodes are marked with isExternal: true for different rendering
    const combinedGraphNodes = useMemo(() => {
        if (!filteredGraphData) return []

        const userNodes = filteredGraphData.nodes.map((n) => ({
            ...n,
            isExternal: false as const,
        }))

        if (!externalNodesConfig.enabled || filteredExternalNodes.length === 0) {
            return userNodes
        }

        // Get set of user IDs in the graph for filtering links
        const userIdsInGraph = new Set(filteredGraphData.nodes.map((n) => n.id))

        // Add external nodes with position hint (start them at edges)
        // x, y will be populated by force simulation at runtime
        const externalNodes = filteredExternalNodes
            .filter((ext) => ext.userIds.some((uid) => userIdsInGraph.has(uid))) // Only show if connected to visible users
            .map((ext) => ({
                id: `ext_${ext.id}`,
                label: ext.label,
                externalType: ext.type,
                uniqueUsers: ext.uniqueUsers,
                txCount: ext.txCount,
                totalUsd: ext.totalUsd,
                userIds: ext.userIds.filter((uid) => userIdsInGraph.has(uid)), // Only connected users in graph
                isExternal: true as const,
                x: undefined as number | undefined,
                y: undefined as number | undefined,
            }))

        return [...userNodes, ...externalNodes]
    }, [filteredGraphData, filteredExternalNodes, externalNodesConfig.enabled])

    // Build links to external nodes
    const externalLinks = useMemo(() => {
        if (!externalNodesConfig.enabled || filteredExternalNodes.length === 0 || !filteredGraphData) {
            return []
        }

        const userIdsInGraph = new Set(filteredGraphData.nodes.map((n) => n.id))
        const links: { source: string; target: string; isExternal: true }[] = []

        filteredExternalNodes.forEach((ext) => {
            const extNodeId = `ext_${ext.id}`
            ext.userIds.forEach((userId) => {
                if (userIdsInGraph.has(userId)) {
                    links.push({
                        source: userId,
                        target: extNodeId,
                        isExternal: true,
                    })
                }
            })
        })

        return links
    }, [filteredExternalNodes, filteredGraphData, externalNodesConfig.enabled])

    // Fetch graph data on mount (only in full mode)
    useEffect(() => {
        if (isMinimal) return

        const fetchData = async () => {
            setLoading(true)
            setError(null)

            const result = await pointsApi.getInvitesGraph(props.apiKey)

            if (result.success && result.data) {
                setFetchedGraphData(result.data)
            } else {
                setError(result.error || 'Failed to load invite graph.')
            }
            setLoading(false)
        }

        fetchData()
    }, [isMinimal, props.apiKey])

    // Fetch external nodes when enabled (lazy load on first enable)
    useEffect(() => {
        if (isMinimal) return
        if (!externalNodesConfig.enabled) return
        if (externalNodesFetchedRef.current) return // Already fetched, don't refetch

        const fetchExternalNodes = async () => {
            setExternalNodesLoading(true)
            setExternalNodesError(null)

            try {
                const result = await pointsApi.getExternalNodes(props.apiKey, {
                    minConnections: 1, // Fetch all, filter client-side for flexibility
                    limit: externalNodesConfig.limit, // User-configurable limit
                })

                if (result.success && result.data) {
                    setExternalNodesData(result.data.nodes)
                    externalNodesFetchedRef.current = true
                    console.log(`Fetched ${result.data.nodes.length} external nodes`)
                } else {
                    const errorMsg = result.error || 'Unknown error'
                    setExternalNodesError(errorMsg)
                    console.error('Failed to fetch external nodes:', errorMsg)
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Network error'
                setExternalNodesError(errorMsg)
                console.error('External nodes fetch error:', err)
            } finally {
                setExternalNodesLoading(false)
            }
        }

        fetchExternalNodes()
    }, [isMinimal, props.apiKey, externalNodesConfig.enabled])

    // Track display settings with ref to avoid re-renders
    // NOTE: These settings only affect RENDERING, not force simulation
    // visibilityConfig changes will hide/show elements without recalculating forces
    const displaySettingsRef = useRef({
        showUsernames,
        selectedUserId,
        isMinimal,
        activityFilter,
        visibilityConfig,
        externalNodesConfig,
    })
    useEffect(() => {
        displaySettingsRef.current = {
            showUsernames,
            selectedUserId,
            isMinimal,
            activityFilter,
            visibilityConfig,
            externalNodesConfig,
        }
    }, [showUsernames, selectedUserId, isMinimal, activityFilter, visibilityConfig, externalNodesConfig])

    // Helper to determine user activity status
    const getUserActivityStatus = useCallback(
        (node: GraphNode, filter: ActivityFilter): 'new' | 'active' | 'inactive' => {
            if (!filter.enabled) return 'active' // No filtering, show all as active

            const now = Date.now()
            const activityCutoff = now - filter.activityDays * 24 * 60 * 60 * 1000

            // Check if signed up within activity window (NEW user)
            const createdAtMs = node.createdAt ? new Date(node.createdAt).getTime() : 0
            const isNewSignup = createdAtMs >= activityCutoff

            // Check if had tx within activity window
            const hasRecentActivity = node.lastActiveAt
                ? new Date(node.lastActiveAt).getTime() >= activityCutoff
                : false

            // Priority: New signup > Active > Inactive
            if (isNewSignup) return 'new'
            if (hasRecentActivity) return 'active'
            return 'inactive'
        },
        []
    )

    // Node styling
    const nodeCanvasObject = useCallback(
        (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const {
                selectedUserId: selId,
                showUsernames: showNames,
                isMinimal: minimal,
                activityFilter: filter,
                visibilityConfig: visibility,
                externalNodesConfig: extConfig,
            } = displaySettingsRef.current

            // ============================================
            // EXTERNAL NODE RENDERING (different shapes)
            // ============================================
            if (node.isExternal) {
                if (!extConfig.enabled) return // Hidden

                const size = 4 + Math.log2(node.uniqueUsers || 1) * 2

                // Colors by type
                const colors: Record<string, string> = {
                    WALLET: '#f59e0b', // Orange/amber
                    BANK: '#3b82f6', // Blue
                    MERCHANT: '#10b981', // Green/emerald
                }
                const fillColor = colors[node.externalType] || '#6b7280'

                ctx.globalAlpha = 0.8
                ctx.fillStyle = fillColor
                ctx.strokeStyle = fillColor
                ctx.lineWidth = 1.5

                // Different shapes by type
                if (node.externalType === 'WALLET') {
                    // Diamond shape for wallets
                    ctx.beginPath()
                    ctx.moveTo(node.x, node.y - size)
                    ctx.lineTo(node.x + size, node.y)
                    ctx.lineTo(node.x, node.y + size)
                    ctx.lineTo(node.x - size, node.y)
                    ctx.closePath()
                    ctx.fill()
                    ctx.stroke()
                } else if (node.externalType === 'BANK') {
                    // Square shape for banks
                    ctx.beginPath()
                    ctx.rect(node.x - size, node.y - size, size * 2, size * 2)
                    ctx.fill()
                    ctx.stroke()
                } else {
                    // Hexagon shape for merchants
                    ctx.beginPath()
                    for (let i = 0; i < 6; i++) {
                        const angle = (Math.PI / 3) * i - Math.PI / 6
                        const x = node.x + size * Math.cos(angle)
                        const y = node.y + size * Math.sin(angle)
                        if (i === 0) ctx.moveTo(x, y)
                        else ctx.lineTo(x, y)
                    }
                    ctx.closePath()
                    ctx.fill()
                    ctx.stroke()
                }

                // Label for external nodes (show at closer zoom)
                if (showNames && globalScale > 1.0) {
                    const fontSize = 10 / globalScale
                    ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.globalAlpha = 0.7
                    ctx.fillStyle = '#374151'
                    ctx.fillText(node.label, node.x, node.y + size + fontSize + 2)
                }

                ctx.globalAlpha = 1
                return
            }

            // ============================================
            // USER NODE RENDERING (circles)
            // ============================================
            const isSelected = node.id === selId
            const hasAccess = node.hasAppAccess

            // Determine activity status for coloring
            // Note: Visibility filtering is done at data level, so hidden nodes never reach here
            const activityStatus = getUserActivityStatus(node, filter)

            const baseSize = hasAccess ? 6 : 3
            const pointsMultiplier = Math.sqrt(node.totalPoints) / 10
            const size = baseSize + Math.min(pointsMultiplier, 25)

            // ===========================================
            // NODE STYLING: Fill + Outline are separate
            // ===========================================
            // FILL: Based on activity status
            //   - Active (signup or tx within window): purple (#8b5cf6)
            //   - Inactive: gray, semi-transparent
            // OUTLINE: Based on access/selection
            //   - Jailed (no app access): black (#000000)
            //   - Selected: golden (#fbbf24)
            //   - Normal: none
            // ===========================================

            let fillColor: string

            if (!filter.enabled) {
                // No filter - simple active/inactive by access
                fillColor = hasAccess ? 'rgba(139, 92, 246, 0.85)' : 'rgba(156, 163, 175, 0.85)'
            } else {
                // Activity filter enabled - three states
                if (activityStatus === 'new') {
                    fillColor = 'rgba(16, 185, 129, 0.85)' // Green for new signups
                } else if (activityStatus === 'active') {
                    fillColor = 'rgba(139, 92, 246, 0.85)' // Purple for active
                } else {
                    // Inactive - exponential time bands with distinct shades
                    const now = Date.now()
                    const createdAtMs = node.createdAt ? new Date(node.createdAt).getTime() : 0
                    const lastActiveMs = node.lastActiveAt ? new Date(node.lastActiveAt).getTime() : 0
                    const lastActivityMs = Math.max(createdAtMs, lastActiveMs)
                    const daysSinceActivity = (now - lastActivityMs) / (24 * 60 * 60 * 1000)
                    
                    // Exponential time bands: 1w, 2w, 4w, 8w, 16w, 32w, 64w+
                    // Each band gets progressively lighter gray
                    if (daysSinceActivity < 7) {
                        fillColor = 'rgba(80, 80, 80, 0.9)'    // Very dark gray - <1 week
                    } else if (daysSinceActivity < 14) {
                        fillColor = 'rgba(100, 100, 100, 0.85)' // Dark gray - 1-2 weeks
                    } else if (daysSinceActivity < 28) {
                        fillColor = 'rgba(120, 120, 120, 0.8)'  // Medium-dark - 2-4 weeks
                    } else if (daysSinceActivity < 56) {
                        fillColor = 'rgba(145, 145, 145, 0.7)'  // Medium gray - 4-8 weeks
                    } else if (daysSinceActivity < 112) {
                        fillColor = 'rgba(170, 170, 170, 0.6)'  // Medium-light - 8-16 weeks
                    } else if (daysSinceActivity < 224) {
                        fillColor = 'rgba(195, 195, 195, 0.5)'  // Light gray - 16-32 weeks
                    } else if (daysSinceActivity < 448) {
                        fillColor = 'rgba(215, 215, 215, 0.4)'  // Very light - 32-64 weeks
                    } else {
                        fillColor = 'rgba(235, 235, 235, 0.3)'  // Almost invisible - 64+ weeks
                    }
                }
            }

            // Draw fill
            ctx.beginPath()
            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI)
            ctx.fillStyle = fillColor
            ctx.fill()

            // Draw outline based on access/selection
            ctx.globalAlpha = 1
            if (isSelected) {
                // Selected: golden outline
                ctx.strokeStyle = '#fbbf24'
                ctx.lineWidth = 3
                ctx.stroke()
            } else if (!hasAccess) {
                // Jailed (no app access): black outline
                ctx.strokeStyle = '#000000'
                ctx.lineWidth = 2
                ctx.stroke()
            }

            ctx.globalAlpha = 1 // Reset alpha

            // In minimal mode, always show labels; otherwise require closer zoom
            if (showNames && (minimal || globalScale > 1.2)) {
                const label = node.username
                const fontSize = minimal ? 4 : 12 / globalScale
                ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillStyle = activityStatus === 'inactive' && filter.enabled ? 'rgba(17, 24, 39, 0.3)' : '#111827'
                ctx.fillText(label, node.x, node.y + size + fontSize + 2)
            }
        },
        [getUserActivityStatus]
    )

    // Helper to check if link connects to inactive node (for faded coloring)
    const isLinkInactive = useCallback(
        (link: any) => {
            const { activityFilter } = displaySettingsRef.current
            const sourceNode = link.source as GraphNode
            const targetNode = link.target as GraphNode
            const sourceStatus = getUserActivityStatus(sourceNode, activityFilter)
            const targetStatus = getUserActivityStatus(targetNode, activityFilter)
            return sourceStatus === 'inactive' || targetStatus === 'inactive'
        },
        [getUserActivityStatus]
    )

    const linkColor = useCallback(
        (link: any) => {
            // P2P edges: cyan/teal - solid line, particles show movement
            if (link.isP2P) {
                if (isLinkInactive(link)) {
                    return 'rgba(6, 182, 212, 0.08)' // Very faint cyan
                }
                return 'rgba(6, 182, 212, 0.25)' // Subtle cyan for P2P
            }
            // Invite edges - solid with arrows
            if (isLinkInactive(link)) {
                return 'rgba(156, 163, 175, 0.12)' // Grey, very transparent
            }
            return link.type === 'DIRECT' ? 'rgba(139, 92, 246, 0.35)' : 'rgba(236, 72, 153, 0.35)'
        },
        [isLinkInactive]
    )

    // Custom link rendering for arrows on invites and particles on P2P
    const linkCanvasObject = useCallback(
        (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const {
                activityFilter,
                visibilityConfig: visibility,
                externalNodesConfig: extConfig,
            } = displaySettingsRef.current
            const source = link.source
            const target = link.target

            if (!source.x || !target.x) return

            // Check visibility for external nodes only (filtered at data level for edges)
            if (link.isExternal && !extConfig.enabled) return

            const inactive = isLinkInactive(link)

            // Calculate line geometry
            const dx = target.x - source.x
            const dy = target.y - source.y
            const len = Math.sqrt(dx * dx + dy * dy)
            if (len === 0) return

            const ux = dx / len // Unit vector x
            const uy = dy / len // Unit vector y

            // ============================================
            // EXTERNAL LINK RENDERING (with animated particles)
            // ============================================
            if (link.isExternal) {
                // Get target node type for color
                const extType = target.externalType || 'WALLET'
                const lineColors: Record<string, string> = {
                    WALLET: 'rgba(245, 158, 11, 0.25)', // Orange
                    BANK: 'rgba(59, 130, 246, 0.25)', // Blue
                    MERCHANT: 'rgba(16, 185, 129, 0.25)', // Green
                }
                const particleColors: Record<string, string> = {
                    WALLET: 'rgba(245, 158, 11, 0.8)', // Orange
                    BANK: 'rgba(59, 130, 246, 0.8)', // Blue
                    MERCHANT: 'rgba(16, 185, 129, 0.8)', // Green
                }

                // Draw base line
                ctx.strokeStyle = lineColors[extType] || 'rgba(107, 114, 128, 0.25)'
                ctx.lineWidth = 0.6
                ctx.beginPath()
                ctx.moveTo(source.x, source.y)
                ctx.lineTo(target.x, target.y)
                ctx.stroke()

                // Animated particles flowing user → external
                const time = performance.now()
                const speed = 0.0003 // Slower than P2P for visual distinction
                const particleSize = 1.5

                ctx.fillStyle = particleColors[extType] || 'rgba(107, 114, 128, 0.8)'

                // Single particle per link (less visual clutter)
                const t = (time * speed) % 1
                const px = source.x + dx * t
                const py = source.y + dy * t
                ctx.beginPath()
                ctx.arc(px, py, particleSize, 0, 2 * Math.PI)
                ctx.fill()

                return
            }

            if (link.isP2P) {
                // P2P: Draw line with animated particles
                const baseAlpha = inactive ? 0.08 : 0.25
                ctx.strokeStyle = `rgba(6, 182, 212, ${baseAlpha})`
                ctx.lineWidth = Math.min(0.5 + (link.count || 1) * 0.2, 2.5)
                ctx.beginPath()
                ctx.moveTo(source.x, source.y)
                ctx.lineTo(target.x, target.y)
                ctx.stroke()

                // Animated particles for P2P
                if (!inactive) {
                    const time = performance.now() // More precise than Date.now()
                    const particleCount = Math.min(1 + Math.floor((link.count || 1) / 2), 4)
                    const speed = 0.0004 + Math.min((link.count || 1) * 0.0001, 0.0003)
                    const particleSize = 2 + Math.min((link.totalUsd || 0) / 300, 3)
                    const isBidirectional = link.bidirectional === true

                    ctx.fillStyle = 'rgba(6, 182, 212, 0.85)'

                    for (let i = 0; i < particleCount; i++) {
                        // Forward direction (source → target)
                        const t1 = (time * speed + i / particleCount) % 1
                        const px1 = source.x + dx * t1
                        const py1 = source.y + dy * t1
                        ctx.beginPath()
                        ctx.arc(px1, py1, particleSize, 0, 2 * Math.PI)
                        ctx.fill()

                        // Reverse direction only if bidirectional
                        if (isBidirectional) {
                            const t2 = (time * speed * 0.85 + (i + 0.5) / particleCount) % 1
                            const px2 = target.x - dx * t2
                            const py2 = target.y - dy * t2
                            ctx.beginPath()
                            ctx.arc(px2, py2, particleSize * 0.85, 0, 2 * Math.PI)
                            ctx.fill()
                        }
                    }
                }
            } else {
                // Invite: Draw line with multiple arrows along the edge
                const isDirect = link.type === 'DIRECT'
                const baseColor = isDirect ? [139, 92, 246] : [236, 72, 153]
                const alpha = inactive ? 0.12 : 0.35
                const arrowAlpha = inactive ? 0.2 : 0.6

                // Draw main line
                ctx.strokeStyle = `rgba(${baseColor.join(',')}, ${alpha})`
                ctx.lineWidth = isDirect ? 1 : 0.8
                ctx.beginPath()
                ctx.moveTo(source.x, source.y)
                ctx.lineTo(target.x, target.y)
                ctx.stroke()

                // Draw arrows along the line (every ~60px, minimum 2)
                // Skip the last arrow to prevent bunching near target node
                const arrowSpacing = 60
                const numArrows = Math.max(2, Math.floor(len / arrowSpacing))
                const arrowSize = inactive ? 3 : 5

                ctx.fillStyle = `rgba(${baseColor.join(',')}, ${arrowAlpha})`

                // Draw arrows from source toward target, but skip the last one (closest to target)
                for (let i = 1; i < numArrows; i++) {
                    // Changed: i < numArrows instead of i <= numArrows
                    const t = i / (numArrows + 1)
                    const ax = source.x + dx * t
                    const ay = source.y + dy * t

                    // Draw arrow head pointing in direction of edge
                    ctx.beginPath()
                    ctx.moveTo(ax + ux * arrowSize, ay + uy * arrowSize)
                    ctx.lineTo(
                        ax - ux * arrowSize * 0.5 - uy * arrowSize * 0.6,
                        ay - uy * arrowSize * 0.5 + ux * arrowSize * 0.6
                    )
                    ctx.lineTo(
                        ax - ux * arrowSize * 0.5 + uy * arrowSize * 0.6,
                        ay - uy * arrowSize * 0.5 - ux * arrowSize * 0.6
                    )
                    ctx.closePath()
                    ctx.fill()
                }
            }
        },
        [isLinkInactive]
    )

    // Handle drag start to track for click vs drag detection
    const handleNodeDragStart = useCallback((node: any, _translate: any) => {
        dragStartRef.current = { x: node.x, y: node.y, time: Date.now() }
        isDraggingRef.current = false
    }, [])

    // Handle drag to detect actual dragging
    const handleNodeDrag = useCallback((node: any) => {
        if (!dragStartRef.current) return
        const dx = node.x - dragStartRef.current.x
        const dy = node.y - dragStartRef.current.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance > CLICK_MAX_DISTANCE_PX) {
            isDraggingRef.current = true
        }
    }, [])

    // Handle drag end
    const handleNodeDragEnd = useCallback(() => {
        // Small delay to let the click handler check the drag state
        setTimeout(() => {
            dragStartRef.current = null
            isDraggingRef.current = false
        }, 50)
    }, [])

    // Click opens appropriate URL for node type
    const handleNodeClick = useCallback(
        (node: any) => {
            // Skip click if we were dragging
            if (isDraggingRef.current) {
                return
            }
            // Also check time-based threshold
            if (dragStartRef.current && Date.now() - dragStartRef.current.time > CLICK_MAX_DURATION_MS) {
                return
            }

            // Handle external node clicks
            if (node.isExternal) {
                const externalId = node.id.replace('ext_', '')

                if (node.externalType === 'WALLET') {
                    // Wallet → Arbiscan
                    window.open(`https://arbiscan.io/address/${externalId}`, '_blank')
                } else if (node.externalType === 'MERCHANT') {
                    // Merchant → Google search
                    window.open(`https://www.google.com/search?q=${encodeURIComponent(node.label)}`, '_blank')
                }
                // BANK → Do nothing (no useful URL for IBAN/CLABE/ACH)
                return
            }

            // User node → Select (camera follows) - click again to open Grafana
            if (selectedUserId === node.id) {
                // Already selected - open Grafana
                const username = node.username || node.id
                window.open(`https://teampeanut.grafana.net/d/ad31f645-81ca-4779-bfb2-bff8e03d9057/explore-peanut-wallet-user?orgId=1&var-GRAFANA_VAR_Username=${encodeURIComponent(username)}`, '_blank')
            } else {
                // Select node
                setSelectedUserId(node.id)
            }
        },
        [selectedUserId]
    )

    // Right-click selects the node (camera follows)
    const handleNodeRightClick = useCallback((node: any) => {
        // Don't select external nodes
        if (node.isExternal) {
            return
        }
        setSelectedUserId((prev) => (prev === node.id ? null : node.id))
    }, [])

    const handleResetView = useCallback(() => {
        // Just reset selection and camera
        setSelectedUserId(null)
        graphRef.current?.zoomToFit(400)
    }, [])

    const handleReset = useCallback(() => {
        // Reset selection
        setSelectedUserId(null)
        // Reset all configs to defaults
        setActivityFilter(DEFAULT_ACTIVITY_FILTER)
        setForceConfig(DEFAULT_FORCE_CONFIG)
        setVisibilityConfig(DEFAULT_VISIBILITY_CONFIG)
        setExternalNodesConfig(DEFAULT_EXTERNAL_NODES_CONFIG)
        // Reset camera
        graphRef.current?.zoomToFit(400)
    }, [])

    // Debounced search to prevent UI freezing
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleSearch = useCallback(
        (query: string) => {
            setSearchQuery(query)

            // Clear any pending search
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }

            if (!prunedGraphData || !query.trim()) {
                setSearchResults([])
                return
            }

            // Debounce the actual search by 150ms
            searchTimeoutRef.current = setTimeout(() => {
                const lowerQuery = query.toLowerCase()
                // Search ALL nodes (not just active/visible ones)
                const results = prunedGraphData.nodes.filter(
                    (node) => node.username && node.username.toLowerCase().includes(lowerQuery)
                )
                setSearchResults(results)

                if (results.length === 1) {
                    setSelectedUserId(results[0].id)
                }
            }, 150)
        },
        [prunedGraphData]
    )

    const handleClearSearch = useCallback(() => {
        setSearchQuery('')
        setSearchResults([])
    }, [])

    // Configure D3 forces - optimized based on analysis
    // Store forceConfig and graph data in refs for access in callbacks
    const forceConfigRef = useRef(forceConfig)
    const filteredGraphDataRef = useRef(filteredGraphData)
    useEffect(() => {
        forceConfigRef.current = forceConfig
        filteredGraphDataRef.current = filteredGraphData
    }, [forceConfig, filteredGraphData])

    const configureForces = useCallback(async () => {
        if (!graphRef.current) return

        const graph = graphRef.current
        const currentGraphData = filteredGraphDataRef.current
        const nodeCount = currentGraphData?.nodes?.length ?? 0
        const isLarge = nodeCount > 1000
        const fc = forceConfigRef.current

        const d3 = await import('d3-force')

        // ===========================================
        // SIMPLIFIED FORCE MODEL - Using D3 built-ins with O(n log n) Barnes-Hut
        // ===========================================

        const linkDistance = isLarge ? 80 : 100

        // CHARGE: D3's forceManyBody with Barnes-Hut approximation (O(n log n))
        // Keep it simple - just use strength, let D3 handle the falloff naturally
        if (fc.charge.enabled) {
            graph.d3Force(
                'charge',
                d3
                    .forceManyBody()
                    .strength((node: any) => {
                        // External nodes: fixed repulsion
                        if (node.isExternal) {
                            return -fc.charge.strength * 0.5
                        }
                        // User nodes: scale slightly with points (bigger nodes push more)
                        const base = -fc.charge.strength
                        const pointsMultiplier = 1 + Math.sqrt(node.totalPoints || 0) / 100
                        return base * Math.min(pointsMultiplier, 2) // Cap at 2x
                    })
                    .distanceMin(10) // Prevent infinite force at very close range
                    .theta(isLarge ? 0.9 : 0.8) // Accuracy vs speed tradeoff
            )
            // NO distanceMax - let repulsion work at all distances
        } else {
            graph.d3Force('charge', null)
        }

        // COLLIDE: Prevents node overlap - use modest radius to avoid fighting with charge
        const collideForce = d3
            .forceCollide()
            .radius((node: any) => {
                // External nodes: size based on connections
                if (node.isExternal) {
                    const size = 4 + Math.log2(node.uniqueUsers || 1) * 2
                    return size * 1.5
                }
                // User nodes: size based on points
                const baseSize = node.hasAppAccess ? 6 : 3
                const pointsMultiplier = Math.sqrt(node.totalPoints || 0) / 10
                const nodeRadius = baseSize + Math.min(pointsMultiplier, 25)
                return nodeRadius * 1.5 // 1.5x = slight padding, doesn't fight charge
            })
            .strength(0.7) // Slightly soft - allows some settling
            .iterations(2) // Fewer iterations needed with softer constraint
        graph.d3Force('collide', collideForce)

        // LINK: Invite, P2P, and External edges all use the same force (from graphData.links)
        // We configure different strengths based on link type
        const linkForce = graph.d3Force('link')
        if (linkForce) {
            // Distance: varies by link type
            linkForce.distance((link: any) => {
                if (link.isP2P) return linkDistance * 0.7 // P2P: tighter clustering
                if (link.isExternal) return linkDistance * 1.2 // External: looser (they're peripheral)
                return linkDistance // Invite: standard
            })

            // Strength: Different per link type, capped at 1.0 to prevent flying nodes
            const extConfig = fc.externalLinks || DEFAULT_FORCE_CONFIG.externalLinks
            linkForce.strength((link: any) => {
                if (link.isP2P) {
                    return fc.p2pLinks.enabled ? Math.min(fc.p2pLinks.strength, 1.0) : 0
                }
                if (link.isExternal) {
                    return extConfig.enabled ? Math.min(extConfig.strength, 1.0) : 0
                }
                return fc.inviteLinks.enabled ? Math.min(fc.inviteLinks.strength, 1.0) : 0
            })

            const inviteStr = fc.inviteLinks.enabled ? Math.min(fc.inviteLinks.strength, 1.0) : 0
            const p2pStr = fc.p2pLinks.enabled ? Math.min(fc.p2pLinks.strength, 1.0) : 0
            const extStr = extConfig.enabled ? Math.min(extConfig.strength, 1.0) : 0
            console.log(
                `[FORCES] Links: invite=${inviteStr.toFixed(2)}, p2p=${p2pStr.toFixed(2)}, ext=${extStr.toFixed(2)}`
            )
        }

        // CENTER: Pulls nodes toward origin. sizeBias controls how much bigger nodes are pulled more
        const centerConfig = fc.center || DEFAULT_FORCE_CONFIG.center
        if (centerConfig.enabled) {
            graph.d3Force(
                'x',
                d3.forceX(0).strength((node: any) => {
                    if (node.isExternal) return centerConfig.strength * 0.5 // External nodes: half strength

                    // sizeBias: 0 = uniform, 1 = big nodes get 2x pull
                    // Formula: strength * (1 + sizeBias * pointsMultiplier)
                    const pointsMultiplier = Math.min(Math.sqrt(node.totalPoints || 0) / 100, 1)
                    return centerConfig.strength * (1 + centerConfig.sizeBias * pointsMultiplier)
                })
            )
            graph.d3Force(
                'y',
                d3.forceY(0).strength((node: any) => {
                    if (node.isExternal) return centerConfig.strength * 0.5
                    const pointsMultiplier = Math.min(Math.sqrt(node.totalPoints || 0) / 100, 1)
                    return centerConfig.strength * (1 + centerConfig.sizeBias * pointsMultiplier)
                })
            )
        } else {
            graph.d3Force('x', null)
            graph.d3Force('y', null)
        }
        graph.d3Force('center', null) // Remove default center (we use X/Y)

        // Note: P2P is handled by the link force above (different strength per link type)
        // No separate 'p2p' force needed - it's all in graphData.links with isP2P flag

        // Mark as configured (used by other effects)
        forcesConfiguredRef.current = true
    }, []) // Empty deps - uses refs for current data

    // Manual recalculation button - resets positions and reconfigures forces
    const handleRecalculate = useCallback(() => {
        if (!graphRef.current) {
            console.log('[RECALC] No graphRef')
            return
        }

        const graph = graphRef.current as any

        // Debug: find where simulation lives
        console.log(
            '[RECALC] Graph keys:',
            Object.keys(graph).filter((k) => !k.startsWith('_'))
        )

        // Try different ways to access simulation
        const simulation =
            graph.d3Force?.('link')?._simulation || // via force
            graph._simulation || // direct
            graph.simulation?.() || // method
            graph.__simulation // alt internal

        // Get nodes from graphData prop or via d3Force
        const linkForce = graph.d3Force?.('link')
        const nodes =
            linkForce?.links?.()?.flatMap?.((l: any) => [l.source, l.target]) ||
            filteredGraphDataRef.current?.nodes ||
            []
        const uniqueNodes = [...new Map(nodes.map((n: any) => [n.id || n, n])).values()]

        console.log('[RECALC] Found nodes:', uniqueNodes.length, 'hasSimulation:', !!simulation)

        if (uniqueNodes.length > 0) {
            // Reset positions on actual node objects
            uniqueNodes.forEach((node: any) => {
                if (typeof node === 'object') {
                    node.x = (Math.random() - 0.5) * 200
                    node.y = (Math.random() - 0.5) * 200
                    node.vx = 0
                    node.vy = 0
                    delete node.fx
                    delete node.fy
                }
            })
            console.log('[RECALC] Reset positions for', uniqueNodes.length, 'nodes')
        }

        // Reheat simulation
        graph.d3ReheatSimulation?.()

        // Also reconfigure forces
        configureForces()
    }, [configureForces])

    // Reconfigure forces when forceConfig changes - do a STRONG reheat
    // Also re-run when filteredGraphData changes (to catch initial mount and data changes)
    useEffect(() => {
        if (!filteredGraphData) return

        const applyForces = () => {
            if (!graphRef.current) return false

            console.log('[FORCES] Configuring:', {
                charge: forceConfig.charge.strength,
                links: forceConfig.inviteLinks.strength,
                nodes: filteredGraphData.nodes.length,
            })

            // configureForces is async - must wait for it to complete before reheating
            configureForces().then(() => {
                if (!graphRef.current) return
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const internalGraph = graphRef.current as any
                if (internalGraph._simulation) {
                    internalGraph._simulation.alpha(1).restart()
                    console.log('[FORCES] Reheated')
                } else {
                    graphRef.current.d3ReheatSimulation()
                }
            })
            return true
        }

        // Try immediately
        if (applyForces()) return

        // If graph not ready yet, retry a few times (graph mounts async)
        const retries = [100, 200, 500]
        const timeouts = retries.map((delay) => setTimeout(() => applyForces(), delay))

        return () => timeouts.forEach(clearTimeout)
    }, [forceConfig, filteredGraphData, configureForces])

    // Initial zoom to fit after graph stabilizes
    const handleEngineStop = useCallback(() => {
        if (!graphRef.current || initialZoomDoneRef.current) return
        // Zoom to fit with padding after initial simulation
        setTimeout(() => {
            graphRef.current?.zoomToFit(400, 40)
            initialZoomDoneRef.current = true
        }, 100)
    }, [])

    // Initial forces are configured by the forceConfig effect above when graph mounts
    // This effect just handles the initial zoom after data arrives
    useEffect(() => {
        if (!filteredGraphData || !graphRef.current) return

        // Give the graph a moment to render, then zoom to fit
        const timeout = setTimeout(() => {
            if (graphRef.current && !initialZoomDoneRef.current) {
                graphRef.current.zoomToFit(400, 40)
                initialZoomDoneRef.current = true
            }
        }, 500)

        return () => clearTimeout(timeout)
    }, [filteredGraphData])

    // Center on selected node - track continuously as it moves
    useEffect(() => {
        if (!selectedUserId || !graphRef.current) return

        let animationFrameId: number | null = null
        let lastCenterTime = 0
        const centerThrottleMs = 50 // Update camera at most every 50ms

        const trackNode = () => {
            if (!graphRef.current) return

            // Find node in combinedGraphNodes (has live position updates from simulation)
            const node = combinedGraphNodes.find((n) => n.id === selectedUserId)
            if (!node || node.x === undefined || node.y === undefined) {
                // Node doesn't have position yet, keep trying
                animationFrameId = requestAnimationFrame(trackNode)
                return
            }

            const now = Date.now()
            if (now - lastCenterTime > centerThrottleMs) {
                // Smoothly follow the node as it moves
                graphRef.current.centerAt(node.x, node.y, 300)
                lastCenterTime = now
            }

            animationFrameId = requestAnimationFrame(trackNode)
        }

        // Initial zoom in
        setTimeout(() => {
            if (graphRef.current) {
                graphRef.current.zoom(3, 800)
            }
        }, 100)

        // Start tracking
        trackNode()

        return () => {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId)
            }
        }
    }, [selectedUserId, combinedGraphNodes])

    // P2P particle animation is handled by:
    // 1. autoPauseRedraw={false} on ForceGraph2D - keeps rendering after simulation stops
    // 2. performance.now() in linkCanvasObject - animates particles based on real time
    // No additional animation loop needed!

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clear any pending search
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }
            // Clear graph ref
            if (graphRef.current) {
                graphRef.current = null
            }
        }
    }, [])

    // Loading state (only for full mode)
    if (!isMinimal && loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="flex items-center gap-3">
                    <Icon name="pending" size={32} className="animate-spin text-purple-600" />
                    <span className="text-lg font-medium text-gray-700">Loading network...</span>
                </div>
            </div>
        )
    }

    // Error state (only for full mode)
    if (!isMinimal && error) {
        return (
            <div className="flex flex-1 items-center justify-center p-4">
                <div className="bg-red-50 max-w-md rounded-2xl p-8 text-center shadow-lg">
                    <div className="mb-4 text-5xl">⚠️</div>
                    <p className="text-red-900 mb-4 text-lg font-medium">{error}</p>
                    {props.onClose && (
                        <Button onClick={props.onClose} variant="stroke">
                            Go Back
                        </Button>
                    )}
                </div>
            </div>
        )
    }

    if (!filteredGraphData) return null

    const graphWidth = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200)
    const graphHeight = height ?? (typeof window !== 'undefined' ? window.innerHeight - 120 : 800)

    // Minimal mode - just the graph canvas
    if (isMinimal) {
        const minimalWidth = containerWidth ?? width ?? 350
        return (
            <>
                <style jsx global>{`
                    .graph-tooltip {
                        background: transparent !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                    }
                `}</style>
                <div
                    ref={containerRef}
                    className="relative w-full"
                    style={{ height: graphHeight, touchAction: 'none' }}
                >
                    {containerWidth !== null && (
                        <ForceGraph2D
                            ref={graphRef}
                            graphData={{
                                nodes: filteredGraphData.nodes,
                                links: [
                                    // Invite edges (reversed for arrow direction)
                                    ...filteredGraphData.edges.map((edge) => ({
                                        ...edge,
                                        source: edge.target,
                                        target: edge.source,
                                        isP2P: false,
                                    })),
                                    // P2P payment edges (for clustering visualization)
                                    ...(filteredGraphData.p2pEdges || []).map((edge, i) => ({
                                        id: `p2p-${i}`,
                                        source: edge.source,
                                        target: edge.target,
                                        type: edge.type,
                                        count: edge.count,
                                        totalUsd: edge.totalUsd,
                                        isP2P: true,
                                    })),
                                ],
                            }}
                            nodeId="id"
                            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                                // Draw hit detection area matching actual rendered node size
                                const hasAccess = node.hasAppAccess
                                const baseSize = hasAccess ? 6 : 3
                                const pointsMultiplier = Math.sqrt(node.totalPoints || 0) / 10
                                const nodeRadius = baseSize + Math.min(pointsMultiplier, 25)
                                ctx.fillStyle = color
                                ctx.beginPath()
                                ctx.arc(node.x, node.y, nodeRadius + 2, 0, 2 * Math.PI) // +2 for easier hover
                                ctx.fill()
                            }}
                            nodeCanvasObject={nodeCanvasObject}
                            nodeCanvasObjectMode={() => 'replace'}
                            linkCanvasObject={linkCanvasObject}
                            linkCanvasObjectMode={() => 'replace'}
                            onNodeClick={handleNodeClick}
                            onNodeRightClick={handleNodeRightClick}
                            onNodeDragStart={handleNodeDragStart}
                            onNodeDrag={handleNodeDrag}
                            onNodeDragEnd={handleNodeDragEnd}
                            enableNodeDrag={true}
                            enablePanInteraction={true}
                            enableZoomInteraction={true}
                            cooldownTicks={Infinity}
                            warmupTicks={0}
                            d3AlphaDecay={0.005}
                            d3VelocityDecay={0.6}
                            d3AlphaMin={0.001}
                            onEngineStop={handleEngineStop}
                            backgroundColor={backgroundColor}
                            width={minimalWidth}
                            height={graphHeight}
                            autoPauseRedraw={false}
                        />
                    )}
                    {/* Reset camera button when focused on a user */}
                    {selectedUserId && (
                        <button
                            onClick={handleResetView}
                            className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md transition-colors hover:bg-gray-50"
                        >
                            <span>←</span>
                            <span>Reset View</span>
                        </button>
                    )}
                    {renderOverlays?.({
                        showUsernames,
                        setShowUsernames,
                        showAllNodes,
                        setShowAllNodes,
                        activityFilter,
                        setActivityFilter,
                        forceConfig,
                        setForceConfig,
                        visibilityConfig,
                        setVisibilityConfig,
                        externalNodesConfig,
                        setExternalNodesConfig,
                        externalNodes: filteredExternalNodes,
                        externalNodesLoading,
                        externalNodesError,
                        handleResetView,
                        handleReset,
                        handleRecalculate,
                    })}
                </div>
            </>
        )
    }

    // Full mode with controls
    return (
        <>
            <style jsx global>{`
                .graph-tooltip {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
            `}</style>
            {/* Top Control Bar */}
            <div className="border-b border-gray-200 bg-white shadow-sm">
                {/* Top Row: Navigation, Title, Stats, Controls */}
                <div className="flex items-center justify-between px-4 py-3">
                    {/* Left: Title & Stats */}
                    <div className="flex items-center gap-4">
                        {props.onClose && (
                            <>
                                <button
                                    onClick={props.onClose}
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                >
                                    <span>←</span>
                                    <span className="hidden sm:inline">Back</span>
                                </button>
                                <div className="h-6 w-px bg-gray-300"></div>
                            </>
                        )}
                        <h1 className="text-lg font-bold text-gray-900">Invite Network</h1>
                        <div className="flex gap-3 text-xs font-medium">
                            <span className="rounded-full bg-purple-100 px-2 py-1 text-purple-700">
                                {combinedGraphNodes.length} nodes
                                {externalNodesConfig.enabled &&
                                    combinedGraphNodes.filter((n: any) => n.isExternal).length > 0 && (
                                        <span className="ml-1 text-orange-600">
                                            (+{combinedGraphNodes.filter((n: any) => n.isExternal).length} ext)
                                        </span>
                                    )}
                            </span>
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">
                                {filteredGraphData.stats.totalEdges + externalLinks.length} edges
                                {externalNodesConfig.enabled && externalLinks.length > 0 && (
                                    <span className="ml-1 text-orange-600">(+{externalLinks.length} ext)</span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Right side - empty, controls are in sidebar overlay */}
                </div>

                {/* Second Row: Search */}
                <div className="border-t border-gray-100 px-4 py-2">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                placeholder="Search username..."
                                className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-9 text-sm transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                            />
                            <Icon
                                name="search"
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                                >
                                    <Icon name="cancel" size={14} />
                                </button>
                            )}
                        </div>
                        {searchResults.length > 0 && (
                            <span className="text-xs text-gray-600">
                                {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
                            </span>
                        )}
                    </div>
                    {/* Search Results Dropdown */}
                    {searchQuery && searchResults.length > 1 && (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                            {searchResults.map((node) => (
                                <button
                                    key={node.id}
                                    onClick={() => {
                                        setSelectedUserId(node.id)
                                        handleClearSearch()
                                    }}
                                    className="flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-purple-50"
                                >
                                    <span className="font-medium text-gray-900">{node.username}</span>
                                    <span className="text-xs text-gray-500">
                                        {node.totalPoints.toLocaleString()} pts
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected User Banner */}
                {selectedUserId && (
                    <div className="border-t border-purple-100 bg-purple-50 px-4 py-2 text-sm">
                        <span className="text-purple-700">
                            Focused on:{' '}
                            <span className="font-bold">
                                {filteredGraphData.nodes.find((n) => n.id === selectedUserId)?.username ||
                                    selectedUserId}
                            </span>
                        </span>
                        <button onClick={handleResetView} className="ml-2 font-semibold text-purple-900 underline">
                            Clear
                        </button>
                    </div>
                )}
            </div>

            {/* Graph Canvas */}
            <div className="relative flex-1" style={{ touchAction: 'none' }}>
                <ForceGraph2D
                    ref={graphRef}
                    graphData={{
                        nodes: combinedGraphNodes,
                        links: [
                            // Invite edges (reversed for arrow direction)
                            ...filteredGraphData.edges.map((edge) => ({
                                ...edge,
                                source: edge.target,
                                target: edge.source,
                                isP2P: false,
                                isExternal: false,
                            })),
                            // P2P payment edges (for clustering visualization)
                            ...(filteredGraphData.p2pEdges || []).map((edge, i) => ({
                                id: `p2p-${i}`,
                                source: edge.source,
                                target: edge.target,
                                type: edge.type,
                                count: edge.count,
                                totalUsd: edge.totalUsd,
                                isP2P: true,
                                isExternal: false,
                            })),
                            // External node links (user → external)
                            ...externalLinks,
                        ],
                    }}
                    nodeId="id"
                    nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                        // Draw hit detection area matching actual rendered node size
                        let size: number
                        if (node.isExternal) {
                            size = 4 + Math.log2(node.uniqueUsers || 1) * 2
                        } else {
                            const hasAccess = node.hasAppAccess
                            const baseSize = hasAccess ? 6 : 3
                            const pointsMultiplier = Math.sqrt(node.totalPoints || 0) / 10
                            size = baseSize + Math.min(pointsMultiplier, 25)
                        }
                        ctx.fillStyle = color
                        ctx.beginPath()
                        ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI) // +2 for easier hover
                        ctx.fill()
                    }}
                    nodeLabel={(node: any) => {
                        // External node tooltip
                        if (node.isExternal) {
                            const fullId = node.id.replace('ext_', '')
                            const typeLabel =
                                node.externalType === 'WALLET'
                                    ? '💳 Wallet'
                                    : node.externalType === 'BANK'
                                      ? `🏦 ${inferBankAccountType(fullId)}`
                                      : '🏪 Merchant'
                            // Show full ID for bank accounts (CLABE/IBAN) for investigation, masked label for others
                            const displayId = node.externalType === 'BANK' ? fullId : node.label
                            return `<div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; font-family: Inter, system-ui, sans-serif; max-width: 280px; padding: 12px 14px;">
                                <div style="font-weight: 700; margin-bottom: 8px; font-size: 14px; color: #1f2937;">${typeLabel}</div>
                                <div style="font-size: 12px; line-height: 1.6; color: #6b7280;">
                                    <div style="margin-bottom: 4px; word-break: break-all;">🏷️ ID: <span style="color: #374151; font-family: monospace;">${displayId}</span></div>
                                    <div style="margin-bottom: 4px;">👥 Users: <span style="color: #374151;">${node.uniqueUsers}</span></div>
                                    <div style="margin-bottom: 4px;">📊 Transactions: <span style="color: #374151;">${node.txCount}</span></div>
                                    <div>💵 Volume: <span style="color: #374151;">$${(node.totalUsd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                                </div>
                            </div>`
                        }
                        // User node tooltip
                        const signupDate = node.createdAt ? new Date(node.createdAt).toLocaleDateString() : 'Unknown'
                        const lastActive = node.lastActiveAt
                            ? new Date(node.lastActiveAt).toLocaleDateString()
                            : 'Never'
                        const invitedBy = inviterMap.get(node.id)
                        // KYC region display with flags
                        const kycFlags: Record<string, string> = {
                            AR: '🇦🇷',
                            BR: '🇧🇷',
                            World: '🌍',
                        }
                        const kycDisplay = node.kycRegions?.length
                            ? node.kycRegions.map((r: string) => `${kycFlags[r] || ''}${r}`).join(', ')
                            : null
                        return `<div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; font-family: Inter, system-ui, sans-serif; max-width: 240px; padding: 12px 14px; box-shadow: none;">
                            <div style="font-weight: 700; margin-bottom: 8px; font-size: 14px; color: #1f2937;">${node.username}</div>
                            <div style="font-size: 12px; line-height: 1.6; color: #6b7280;">
                                <div style="margin-bottom: 4px;">📅 Signed up: <span style="color: #374151;">${signupDate}</span></div>
                                <div style="margin-bottom: 4px;">⚡ Last active: <span style="color: #374151;">${lastActive}</span></div>
                                ${invitedBy ? `<div style="margin-bottom: 4px;">👤 Invited by: <span style="color: #8b5cf6; font-weight: 500;">${invitedBy}</span></div>` : ''}
                                <div style="margin-bottom: 4px;">${node.hasAppAccess ? '<span style="color: #10b981;">✓ Has Access</span>' : '<span style="color: #f59e0b;">⏳ Jailed</span>'}</div>
                                ${kycDisplay ? `<div style="margin-bottom: 4px;">🪪 KYC: <span style="color: #374151;">${kycDisplay}</span></div>` : ''}
                                <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px;">
                                    ${node.totalPoints.toLocaleString()} pts (${node.directPoints} direct, ${node.transitivePoints} trans)
                                </div>
                            </div>
                        </div>`
                    }}
                    nodeCanvasObject={nodeCanvasObject}
                    nodeCanvasObjectMode={() => 'replace'}
                    linkLabel={(link: any) =>
                        link.isP2P
                            ? `P2P: ${link.count} txs ($${link.totalUsd?.toFixed(2) ?? '0'})`
                            : `${link.type} - ${new Date(link.createdAt).toLocaleDateString()}`
                    }
                    linkCanvasObject={linkCanvasObject}
                    linkCanvasObjectMode={() => 'replace'}
                    onNodeClick={handleNodeClick}
                    onNodeRightClick={handleNodeRightClick}
                    onNodeDragStart={handleNodeDragStart}
                    onNodeDrag={handleNodeDrag}
                    onNodeDragEnd={handleNodeDragEnd}
                    enableNodeDrag={true}
                    enablePanInteraction={true}
                    enableZoomInteraction={true}
                    cooldownTicks={Infinity}
                    warmupTicks={0}
                    d3AlphaDecay={0.005}
                    d3VelocityDecay={0.6}
                    d3AlphaMin={0.001}
                    onEngineStop={handleEngineStop}
                    backgroundColor="#f9fafb"
                    width={graphWidth}
                    height={graphHeight}
                    autoPauseRedraw={false}
                />

                {/* Render overlays (legend, mobile controls) via render prop */}
                {renderOverlays?.({
                    showUsernames,
                    setShowUsernames,
                    showAllNodes,
                    setShowAllNodes,
                    activityFilter,
                    setActivityFilter,
                    forceConfig,
                    setForceConfig,
                    visibilityConfig,
                    setVisibilityConfig,
                    externalNodesConfig,
                    setExternalNodesConfig,
                    externalNodes: filteredExternalNodes,
                    externalNodesLoading,
                    externalNodesError,
                    handleResetView,
                    handleReset,
                    handleRecalculate,
                })}
            </div>
        </>
    )
}
