import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGraphPreferences } from '@/hooks/useGraphPreferences'
import {
    type ActivityFilter,
    type ExternalNode,
    type ExternalNodesConfig,
    type ForceConfig,
    type FullModeProps,
    type GraphData,
    type GraphMode,
    type GraphNode,
    type InvitesGraphProps,
    type VisibilityConfig,
    DEFAULT_FORCE_CONFIG,
} from './types'

interface UseInvitesGraphDataParams {
    props: InvitesGraphProps
    isMinimal: boolean
    mode: GraphMode
    initialShowUsernames: boolean
    initialTopNodes: number
    modeActivityFilter: ActivityFilter
    finalModeForceConfig: ForceConfig
    modeVisibilityConfig: VisibilityConfig
    modeExternalNodesConfig: ExternalNodesConfig
}

/**
 * Owns graph data + configuration state and its persistence:
 * fetched data holders, visual/data settings, saved-preferences restore/save,
 * and the raw → visibility-filtered graph data pipeline.
 */
export function useInvitesGraphData({
    props,
    isMinimal,
    mode,
    initialShowUsernames,
    initialTopNodes,
    modeActivityFilter,
    finalModeForceConfig,
    modeVisibilityConfig,
    modeExternalNodesConfig,
}: UseInvitesGraphDataParams) {
    // Data state
    const [fetchedGraphData, setFetchedGraphData] = useState<GraphData | null>(null)
    const [loading, setLoading] = useState(!isMinimal)
    const [error, setError] = useState<string | null>(null)

    // UI state (declare early so they can be used in data processing)
    const [showUsernames, setShowUsernames] = useState(initialShowUsernames)
    // topNodes: limit to top N by points (0 = all). Backend-filtered, triggers refetch.
    const [topNodes, setTopNodes] = useState(initialTopNodes)
    // Hidden activity statuses — purely visual toggle (no re-layout)
    const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set())

    // Particle arrival popups for user mode (+1 pt animations)
    // Map: linkId → { timestamp, x, y, nodeId }
    const _particleArrivalsRef = useRef<Map<string, { timestamp: number; x: number; y: number; nodeId: string }>>(
        new Map()
    )

    // Use passed data in minimal mode, fetched data otherwise
    // Note: topNodes filtering is now done by backend, no client-side pruning needed
    // Performance mode: frontend filter to top 1000 without refetch
    const rawGraphData = useMemo(() => {
        const data = isMinimal ? props.data : fetchedGraphData
        if (!data) return null

        // Minimal mode (points page): cap at 200 nodes for performance
        if (isMinimal && data.nodes.length > 200) {
            const sortedNodes = [...data.nodes].sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0))
            const limitedNodes = sortedNodes.slice(0, 200)
            const limitedNodeIds = new Set(limitedNodes.map((n) => n.id))
            const filteredEdges = data.edges.filter(
                (edge) => limitedNodeIds.has(edge.source) && limitedNodeIds.has(edge.target)
            )
            return {
                nodes: limitedNodes,
                edges: filteredEdges,
                p2pEdges: [],
                stats: {
                    ...data.stats,
                    totalNodes: limitedNodes.length,
                    totalEdges: filteredEdges.length,
                    totalP2PEdges: 0,
                },
            }
        }

        // Performance mode: limit to top 1000 nodes on frontend (payment graph only)
        const performanceMode = !isMinimal && (props as FullModeProps).performanceMode
        if (performanceMode && data.nodes.length > 1000) {
            // Sort by size label (payment mode) or totalPoints (full mode) and take top 1000
            const sortedNodes = [...data.nodes].sort((a, b) => {
                // Payment mode nodes have size labels, full mode has totalPoints
                if (a.totalPoints !== undefined && b.totalPoints !== undefined) {
                    return b.totalPoints - a.totalPoints
                }
                // Size label sorting: huge > large > medium > small > tiny
                const sizeOrder: Record<string, number> = { huge: 5, large: 4, medium: 3, small: 2, tiny: 1 }
                const aSize = (a as any).size || 'tiny'
                const bSize = (b as any).size || 'tiny'
                return (sizeOrder[bSize as string] || 0) - (sizeOrder[aSize as string] || 0)
            })
            const limitedNodes = sortedNodes.slice(0, 1000)
            const limitedNodeIds = new Set(limitedNodes.map((n) => n.id))

            // Filter edges and P2P edges to only include connections between limited nodes
            const filteredEdges = data.edges.filter(
                (edge) => limitedNodeIds.has(edge.source) && limitedNodeIds.has(edge.target)
            )
            const filteredP2PEdges = (data.p2pEdges || []).filter(
                (edge) => limitedNodeIds.has(edge.source) && limitedNodeIds.has(edge.target)
            )

            return {
                nodes: limitedNodes,
                edges: filteredEdges,
                p2pEdges: filteredP2PEdges,
                stats: {
                    ...data.stats,
                    totalNodes: limitedNodes.length,
                    totalEdges: filteredEdges.length,
                    totalP2PEdges: filteredP2PEdges.length,
                },
            }
        }

        return data
    }, [isMinimal, props, fetchedGraphData])

    // Helper to check if node is active based on activityDays threshold
    // Used for both coloring and visibility filtering
    const isNodeActive = useCallback((node: GraphNode, filter: ActivityFilter): boolean => {
        // In payment mode, nodes are anonymized and lack timestamps
        // Treat all nodes as "active" since we can't determine activity
        if (!node.createdAt && !node.lastActiveAt) {
            return true
        }

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
    const [activityFilter, setActivityFilter] = useState<ActivityFilter>(modeActivityFilter)
    const [forceConfig, setForceConfig] = useState<ForceConfig>(finalModeForceConfig)
    const [visibilityConfig, setVisibilityConfig] = useState<VisibilityConfig>(modeVisibilityConfig)

    // External nodes state (wallets, banks, merchants)
    const [externalNodesConfig, setExternalNodesConfig] = useState<ExternalNodesConfig>(modeExternalNodesConfig)
    const [externalNodesData, setExternalNodesData] = useState<ExternalNode[]>([])
    const [externalNodesLoading, setExternalNodesLoading] = useState(false)
    const [externalNodesError, setExternalNodesError] = useState<string | null>(null)
    // Track fetch state: stores the limit used for last fetch, or null if never fetched
    // This allows refetch when limit changes while preventing refetch on toggle off/on
    const externalNodesFetchedLimitRef = useRef<number | null>(null)

    // Graph preferences persistence (separate storage for payment vs full mode)
    const isPaymentMode = mode === 'payment'
    const {
        preferences,
        savePreferences,
        isLoaded: preferencesLoaded,
    } = useGraphPreferences(isPaymentMode ? 'payment' : 'full')
    const preferencesRestoredRef = useRef(false)

    // Load preferences ONCE on mount (not in minimal mode)
    // Payment and full mode now have separate storage
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

        // Payment mode: NEVER restore activityDays (fixed at 120) or topNodes (always use prop)
        // Full mode: restore both
        if (preferences.activityFilter) {
            if (isPaymentMode) {
                // Restore enabled/hideInactive, but keep activityDays at 120
                setActivityFilter({
                    ...preferences.activityFilter,
                    activityDays: 120,
                })
            } else {
                setActivityFilter(preferences.activityFilter)
            }
        }

        if (preferences.externalNodesConfig) setExternalNodesConfig(preferences.externalNodesConfig)
        if (preferences.showUsernames !== undefined) setShowUsernames(preferences.showUsernames)

        // Payment mode: NEVER restore topNodes - always use prop value (5000 for full data)
        if (!isPaymentMode && preferences.topNodes !== undefined) {
            setTopNodes(preferences.topNodes)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preferencesLoaded, isMinimal]) // Only depend on preferencesLoaded, not preferences

    // Auto-save preferences when they change (debounced to avoid excessive writes)
    // Skip saving until preferences have been restored to avoid overwriting with defaults
    // Payment and full mode now save to separate keys, so no pollution
    useEffect(() => {
        if (isMinimal || !preferencesRestoredRef.current) return

        const timeout = setTimeout(() => {
            savePreferences({
                forceConfig,
                visibilityConfig,
                activityFilter,
                externalNodesConfig,
                showUsernames,
                topNodes,
            })
        }, 1000) // Debounce 1 second

        return () => clearTimeout(timeout)
    }, [
        forceConfig,
        visibilityConfig,
        activityFilter,
        externalNodesConfig,
        showUsernames,
        topNodes,
        isMinimal,
        savePreferences,
    ])

    // Filter nodes/edges based on visibility settings (DELETE approach)
    // All visibility toggles remove data from simulation for better performance and accurate layout
    const graphData = useMemo(() => {
        if (!rawGraphData) return null

        // Start with all nodes
        let filteredNodes = rawGraphData.nodes

        // Filter by activity time window AND active/inactive checkboxes
        // activityDays defines the time window (e.g., 30 days)
        // Nodes are classified as active (within window) or inactive (outside window)
        // Then visibilityConfig checkboxes control which category to show
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
        let filteredEdges = rawGraphData.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        if (!visibilityConfig.inviteEdges) {
            filteredEdges = []
        }

        // Safety: detect duplicate node IDs (should never happen after SHA-256 fix)
        console.assert(
            nodeIds.size === filteredNodes.length,
            `Duplicate node IDs detected: ${filteredNodes.length} nodes collapsed to ${nodeIds.size} unique IDs`
        )

        let filteredP2PEdges = (rawGraphData.p2pEdges || []).filter(
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
    }, [rawGraphData, activityFilter.activityDays, visibilityConfig, isNodeActive])

    return {
        // data
        fetchedGraphData,
        setFetchedGraphData,
        loading,
        setLoading,
        error,
        setError,
        rawGraphData,
        graphData,
        // ui state
        showUsernames,
        setShowUsernames,
        topNodes,
        setTopNodes,
        hiddenStatuses,
        setHiddenStatuses,
        // config state
        activityFilter,
        setActivityFilter,
        forceConfig,
        setForceConfig,
        visibilityConfig,
        setVisibilityConfig,
        // external nodes
        externalNodesConfig,
        setExternalNodesConfig,
        externalNodesData,
        setExternalNodesData,
        externalNodesLoading,
        setExternalNodesLoading,
        externalNodesError,
        setExternalNodesError,
        externalNodesFetchedLimitRef,
    }
}
