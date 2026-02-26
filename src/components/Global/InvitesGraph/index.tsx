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
 *   - topNodes: Limit to top N nodes by points (0 = all, default 5000)
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
import { pointsApi } from '@/services/points'
import { inferBankAccountType } from '@/utils/bridge.utils'
import { useGraphPreferences } from '@/hooks/useGraphPreferences'
import {
    type GraphNode,
    type GraphData,
    type ActivityFilter,
    type ForceConfig,
    type VisibilityConfig,
    type ExternalNodesConfig,
    type ExternalNode,
    type SizeLabel,
    DEFAULT_FORCE_CONFIG,
    DEFAULT_VISIBILITY_CONFIG,
    DEFAULT_EXTERNAL_NODES_CONFIG,
    DEFAULT_ACTIVITY_FILTER,
} from './types'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
}) as any

// Constants for drag vs click detection
const CLICK_MAX_DURATION_MS = 200
const CLICK_MAX_DISTANCE_PX = 5

// Helper to convert qualitative size labels to numeric points for graph calculations
// Used in payment mode where real points aren't sent to frontend
function sizeLabelToPoints(size: SizeLabel | undefined): number {
    if (!size) return 10 // default
    switch (size) {
        case 'tiny':
            return 5
        case 'small':
            return 50
        case 'medium':
            return 500
        case 'large':
            return 5000
        case 'huge':
            return 50000
    }
}

// Helper to get effective points for a node (real points in full mode, converted from size in payment mode)
function getNodePoints(node: any): number {
    // Payment mode: node has size label instead of totalPoints
    if (node.size && !node.totalPoints) {
        return sizeLabelToPoints(node.size)
    }
    // Full mode: use real totalPoints
    return node.totalPoints || 0
}

// Helper to get effective unique users count for external nodes
function getExternalNodeUsers(node: any): number {
    // Payment mode: use userIds array length (accurate count of connections in graph)
    if (node.userIds && node.userIds.length > 0) {
        return node.userIds.length
    }
    // Full mode: use real uniqueUsers count
    if (node.uniqueUsers !== undefined) {
        return node.uniqueUsers
    }
    // Fallback: shouldn't reach here in normal operation
    return 1
}

/** Graph mode determines which features are enabled */
export type GraphMode = 'full' | 'payment' | 'user'

interface BaseProps {
    width?: number
    height?: number
    backgroundColor?: string
    /** Show usernames on nodes */
    showUsernames?: boolean
    /** Limit to top N nodes by points (0 = all nodes, default 5000). Backend filtering. */
    topNodes?: number
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
        /** Top N nodes limit (0 = all). Changing triggers backend refetch. */
        topNodes: number
        setTopNodes: (v: number) => void
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
    /** Password for payment mode authentication */
    password?: string
    /** Graph mode: 'full' shows all features, 'payment' shows P2P only (no invites, fixed 120-day window) */
    mode?: GraphMode
    /** Close/back button handler */
    onClose?: () => void
    /** Performance mode: limit to top 1000 nodes (frontend-filtered, no refetch) */
    performanceMode?: boolean
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

// Default top nodes limit (0 = all nodes, backend-filtered)
const DEFAULT_TOP_NODES = 5000

export default function InvitesGraph(props: InvitesGraphProps) {
    const {
        width,
        height,
        backgroundColor = '#FAF4F0',
        showUsernames: initialShowUsernames = true,
        topNodes: initialTopNodes = DEFAULT_TOP_NODES,
        activityFilter: initialActivityFilter = DEFAULT_ACTIVITY_FILTER,
        forceConfig: initialForceConfig = DEFAULT_FORCE_CONFIG,
        visibilityConfig: initialVisibilityConfig = DEFAULT_VISIBILITY_CONFIG,
        renderOverlays,
    } = props

    const isMinimal = props.minimal === true
    // Get mode from props - defaults to 'full' for non-minimal, 'user' for minimal
    const mode: GraphMode = isMinimal ? 'user' : (props.mode ?? 'full')

    // Mode-specific defaults
    // Payment mode: 120-day fixed window, no invite edges
    // User mode: invite edges only (no P2P), used for points animation
    const modeActivityFilter: ActivityFilter =
        mode === 'payment' ? { ...initialActivityFilter, activityDays: 120 } : initialActivityFilter
    const modeVisibilityConfig: VisibilityConfig =
        mode === 'payment'
            ? { ...initialVisibilityConfig, inviteEdges: false }
            : mode === 'user'
              ? { ...initialVisibilityConfig, p2pEdges: false }
              : initialVisibilityConfig
    const modeForceConfig: ForceConfig =
        mode === 'payment'
            ? { ...initialForceConfig, inviteLinks: { ...initialForceConfig.inviteLinks, enabled: false } }
            : mode === 'user'
              ? {
                    ...initialForceConfig,
                    p2pLinks: { ...initialForceConfig.p2pLinks, enabled: false },
                    // Stronger repulsion for user graph to prevent overlap in small space
                    charge: { ...initialForceConfig.charge, strength: initialForceConfig.charge.strength * 3 },
                    // Longer link distance for clearer separation
                    inviteLinks: { ...initialForceConfig.inviteLinks, distance: 80 },
                }
              : initialForceConfig
    // Payment mode: merchants enabled by default with minConnections=10, weaker link force (0.1x)
    const modeExternalNodesConfig: ExternalNodesConfig =
        mode === 'payment'
            ? {
                  enabled: true,
                  minConnections: 10,
                  limit: 5000,
                  types: { WALLET: false, BANK: false, MERCHANT: true },
              }
            : DEFAULT_EXTERNAL_NODES_CONFIG
    // Apply payment mode external link force adjustment (0.1x default - weak to avoid clustering)
    const finalModeForceConfig: ForceConfig =
        mode === 'payment'
            ? {
                  ...modeForceConfig,
                  externalLinks: {
                      ...DEFAULT_FORCE_CONFIG.externalLinks,
                      strength: DEFAULT_FORCE_CONFIG.externalLinks.strength * 0.1,
                  },
              }
            : modeForceConfig

    // Data state
    const [fetchedGraphData, setFetchedGraphData] = useState<GraphData | null>(null)
    const [loading, setLoading] = useState(!isMinimal)
    const [error, setError] = useState<string | null>(null)

    // UI state (declare early so they can be used in data processing)
    const [showUsernames, setShowUsernames] = useState(initialShowUsernames)
    // topNodes: limit to top N by points (0 = all). Backend-filtered, triggers refetch.
    const [topNodes, setTopNodes] = useState(initialTopNodes)

    // Particle arrival popups for user mode (+1 pt animations)
    // Map: linkId → { timestamp, x, y, nodeId }
    const particleArrivalsRef = useRef<Map<string, { timestamp: number; x: number; y: number; nodeId: string }>>(
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
                stats: { ...data.stats, totalNodes: limitedNodes.length, totalEdges: filteredEdges.length, totalP2PEdges: 0 },
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
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<GraphNode[]>([])

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

    // Build set of inviter node IDs (nodes that have outgoing invite edges)
    // Used in minimal/user mode to show heart icon next to inviter usernames
    const inviterNodes = useMemo(() => {
        if (!filteredGraphData) return new Set<string>()
        const set = new Set<string>()
        filteredGraphData.edges.forEach((edge) => {
            set.add(edge.source) // source = inviter
        })
        return set
    }, [filteredGraphData])

    // Build set of node IDs that participate in P2P (for payment mode coloring)
    // A node is "P2P active" if it's the source or target of any P2P edge
    const p2pActiveNodes = useMemo(() => {
        if (!rawGraphData) return new Set<string>()
        const set = new Set<string>()
        ;(rawGraphData.p2pEdges || []).forEach((edge) => {
            set.add(edge.source)
            set.add(edge.target)
        })
        return set
    }, [rawGraphData])

    // Filter external nodes based on config (client-side for fast UI updates)
    const filteredExternalNodes = useMemo(() => {
        if (!externalNodesConfig.enabled) return []

        const now = Date.now()
        const activityCutoff = now - activityFilter.activityDays * 24 * 60 * 60 * 1000
        const isPaymentMode = mode === 'payment'

        const filtered = externalNodesData.filter((node) => {
            // Filter by minConnections
            // In payment mode: count unique user IDs from userIds array
            // In full mode: use uniqueUsers or fall back to size label conversion
            let userCount: number
            if (isPaymentMode) {
                // Payment mode: count actual user IDs in the array
                userCount = node.userIds?.length || 0
            } else {
                // Full mode: use helper which reads uniqueUsers or converts size label
                userCount = getExternalNodeUsers(node)
            }

            if (userCount < externalNodesConfig.minConnections) {
                return false
            }

            // Filter by type
            if (!externalNodesConfig.types[node.type]) return false
            // Filter by activity window (only in full mode where lastTxDate exists)
            if (node.lastTxDate) {
                const lastTxMs = new Date(node.lastTxDate).getTime()
                if (lastTxMs < activityCutoff) return false
            }
            return true
        })

        return filtered
    }, [externalNodesData, externalNodesConfig, activityFilter.activityDays])

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

        // Helper to extract userId from userTxData keys (full mode only)
        // Keys can be: `${userId}_${direction}` (e.g., "abc123_INCOMING") or just `${userId}` (old format)
        // User IDs may contain underscores, so we use lastIndexOf to find the direction suffix
        const extractUserIdFromKey = (key: string): string => {
            if (key.endsWith('_INCOMING') || key.endsWith('_OUTGOING')) {
                return key.substring(0, key.lastIndexOf('_'))
            }
            return key // Old format: key is just the userId
        }

        // Get connected user IDs for an external node
        // In payment mode: use userIds array (real UUIDs for graph linking)
        // In full mode: use userIds if available, otherwise extract from userTxData keys
        const getConnectedUserIds = (ext: ExternalNode): string[] => {
            if (ext.userIds && ext.userIds.length > 0) {
                return ext.userIds
            }
            return Object.keys(ext.userTxData || {}).map(extractUserIdFromKey)
        }

        // Add external nodes with position hint (start them at edges)
        // x, y will be populated by force simulation at runtime
        // Track filtered out nodes for debugging
        const filteredOutByVisibility = { WALLET: 0, BANK: 0, MERCHANT: 0 }
        const externalNodes = filteredExternalNodes
            .filter((ext) => {
                // Only show if connected to visible users
                const connectedUserIds = getConnectedUserIds(ext)
                const hasVisibleUser = connectedUserIds.some((uid: string) => userIdsInGraph.has(uid))
                if (!hasVisibleUser) {
                    filteredOutByVisibility[ext.type as keyof typeof filteredOutByVisibility]++
                }
                return hasVisibleUser
            })
            .map((ext) => {
                const connectedUserIds = getConnectedUserIds(ext)
                const filteredUserIds = connectedUserIds.filter((uid: string) => userIdsInGraph.has(uid))
                return {
                    id: `ext_${ext.id}`,
                    label: ext.label,
                    externalType: ext.type,
                    uniqueUsers: ext.uniqueUsers,
                    txCount: ext.txCount,
                    totalUsd: ext.totalUsd,
                    frequency: ext.frequency,
                    volume: ext.volume,
                    userIds: filteredUserIds,
                    isExternal: true as const,
                    x: undefined as number | undefined,
                    y: undefined as number | undefined,
                }
            })

        const combined = [...userNodes, ...externalNodes]

        // Safety: detect duplicate external node IDs
        const externalNodeIds = new Set(externalNodes.map((n) => n.id))
        console.assert(
            externalNodeIds.size === externalNodes.length,
            `Duplicate external node IDs: ${externalNodes.length} nodes collapsed to ${externalNodeIds.size} unique IDs`
        )

        return combined
    }, [filteredGraphData, externalNodesConfig.enabled, filteredExternalNodes])

    // Build links to external nodes with per-user transaction data and direction
    // Creates separate links for INCOMING and OUTGOING to enable correct particle flow
    // Supports both full mode (txCount, totalUsd) and anonymized mode (frequency, volume)
    const externalLinks = useMemo(() => {
        if (!externalNodesConfig.enabled || filteredExternalNodes.length === 0 || !filteredGraphData) {
            return []
        }

        const userIdsInGraph = new Set(filteredGraphData.nodes.map((n) => n.id))
        const isPaymentMode = mode === 'payment'

        type ExternalLink = {
            source: string
            target: string
            isExternal: true
            direction: 'INCOMING' | 'OUTGOING'
        } & ({ txCount: number; totalUsd: number } | { frequency: string; volume: string })

        const links: ExternalLink[] = []

        filteredExternalNodes.forEach((ext) => {
            const extNodeId = `ext_${ext.id}`

            // In payment mode, userTxData keys are anonymized (hex IDs)
            // Parse userTxData to get per-user direction, frequency, and volume
            if (isPaymentMode) {
                // userTxData format: { "hexUserId_DIRECTION": { direction, frequency, volume } }
                Object.entries(ext.userTxData || {}).forEach(([key, data]) => {
                    // Parse userId and direction from key format: "hexUserId_DIRECTION"
                    const lastUnderscoreIdx = key.lastIndexOf('_')
                    if (lastUnderscoreIdx === -1) return // Skip malformed keys

                    const hexUserId = key.substring(0, lastUnderscoreIdx)
                    const direction = key.substring(lastUnderscoreIdx + 1) as 'INCOMING' | 'OUTGOING'

                    // userTxData keys are hex-anonymized, but graph nodes use the original hex IDs
                    // Match by checking if this hex ID is in the graph
                    if (!userIdsInGraph.has(hexUserId)) {
                        return
                    }

                    links.push({
                        source: hexUserId,
                        target: extNodeId,
                        isExternal: true,
                        frequency: data.frequency || ext.frequency || 'occasional',
                        volume: data.volume || ext.volume || 'medium',
                        direction: direction,
                    })
                })

                return
            }

            // Full mode: userTxData keys can be in two formats:
            // - New format: `${userId}_${direction}` (e.g., "abc123_INCOMING", "abc123_OUTGOING")
            // - Old format: just `${userId}` (e.g., "abc123") - backwards compatibility
            Object.entries(ext.userTxData || {}).forEach(([key, data]) => {
                // Check if key ends with _INCOMING or _OUTGOING (new format)
                const isNewFormat = key.endsWith('_INCOMING') || key.endsWith('_OUTGOING')

                let userId: string
                let direction: 'INCOMING' | 'OUTGOING'

                if (isNewFormat) {
                    // New format: parse userId and direction from key
                    const lastUnderscoreIdx = key.lastIndexOf('_')
                    userId = key.substring(0, lastUnderscoreIdx)
                    direction = key.substring(lastUnderscoreIdx + 1) as 'INCOMING' | 'OUTGOING'
                } else {
                    // Old format: key is just userId, default to OUTGOING (original behavior)
                    userId = key
                    direction = data.direction || 'OUTGOING'
                }

                if (!userIdsInGraph.has(userId)) return

                // Handle both full and anonymized data formats
                if (data.txCount !== undefined && data.totalUsd !== undefined) {
                    // Full mode: use exact values
                    links.push({
                        source: userId,
                        target: extNodeId,
                        isExternal: true,
                        txCount: data.txCount,
                        totalUsd: data.totalUsd,
                        direction: direction,
                    })
                } else if (data.frequency && data.volume) {
                    // Anonymized mode: use labels
                    links.push({
                        source: userId,
                        target: extNodeId,
                        isExternal: true,
                        frequency: data.frequency,
                        volume: data.volume,
                        direction: direction,
                    })
                }
            })
        })

        return links
    }, [filteredExternalNodes, filteredGraphData, externalNodesConfig.enabled, mode])

    // Fetch graph data on mount and when topNodes changes (only in full mode)
    // Note: topNodes filtering only applies to full mode (payment mode has fixed 5000 limit in backend)
    useEffect(() => {
        if (isMinimal) return

        const fetchData = async () => {
            setLoading(true)
            setError(null)

            // API only supports 'full' | 'payment' modes (user mode uses different endpoint)
            const apiMode = mode === 'payment' ? 'payment' : 'full'
            // Pass topNodes for both modes - payment mode now supports it via Performance button
            // Pass password for payment mode authentication
            const result = await pointsApi.getInvitesGraph(props.apiKey, {
                mode: apiMode,
                topNodes: topNodes > 0 ? topNodes : undefined,
                password: mode === 'payment' ? props.password : undefined,
            })

            if (result.success && result.data) {
                setFetchedGraphData(result.data)
            } else {
                setError(result.error || 'Failed to load invite graph.')
            }
            setLoading(false)
        }

        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMinimal, !isMinimal && props.apiKey, mode, topNodes])

    // Fetch external nodes when enabled (lazy load on first enable)
    // Refetch if limit changes (but not on simple toggle off/on)
    useEffect(() => {
        if (isMinimal) return
        if (!externalNodesConfig.enabled) return
        // Skip if already fetched with same or higher limit (no need to refetch for same data)
        const lastLimit = externalNodesFetchedLimitRef.current
        if (lastLimit !== null && lastLimit >= externalNodesConfig.limit) return

        const fetchExternalNodes = async () => {
            setExternalNodesLoading(true)
            setExternalNodesError(null)

            try {
                // API only supports 'full' | 'payment' modes
                const apiMode = mode === 'payment' ? 'payment' : 'full'
                // Fetch ALL types so user can toggle client-side without refetch
                // Backend defaults to MERCHANT only in payment mode, so we must explicitly request all
                const result = await pointsApi.getExternalNodes(props.apiKey, {
                    mode: apiMode,
                    minConnections: 1, // Fetch all, filter client-side for flexibility
                    limit: externalNodesConfig.limit, // User-configurable limit
                    types: ['WALLET', 'BANK', 'MERCHANT'], // Fetch all types, filter client-side
                    topNodes: topNodes > 0 ? topNodes : undefined, // Match graph's top-N filter
                    password: apiMode === 'payment' ? props.password : undefined, // Password for payment mode
                })

                if (result.success && result.data) {
                    // Debug logging for external nodes
                    setExternalNodesData(result.data.nodes)
                    externalNodesFetchedLimitRef.current = externalNodesConfig.limit
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMinimal, !isMinimal && props.apiKey, externalNodesConfig.enabled, mode, externalNodesConfig.limit])

    // Track display settings with ref to avoid re-renders
    // NOTE: These settings only affect RENDERING, not force simulation
    // visibilityConfig changes will hide/show elements without recalculating forces
    const displaySettingsRef = useRef({
        showUsernames,
        selectedUserId,
        isMinimal,
        mode,
        activityFilter,
        visibilityConfig,
        externalNodesConfig,
        p2pActiveNodes,
        inviterNodes,
    })
    useEffect(() => {
        displaySettingsRef.current = {
            showUsernames,
            selectedUserId,
            isMinimal,
            mode,
            activityFilter,
            visibilityConfig,
            externalNodesConfig,
            p2pActiveNodes,
            inviterNodes,
        }
    }, [
        showUsernames,
        selectedUserId,
        isMinimal,
        mode,
        activityFilter,
        visibilityConfig,
        externalNodesConfig,
        p2pActiveNodes,
        inviterNodes,
    ])

    // Helper to determine user activity status
    const getUserActivityStatus = useCallback(
        (node: GraphNode, filter: ActivityFilter): 'new' | 'active' | 'inactive' => {
            if (!filter.enabled) return 'active' // No filtering, show all as active

            // In payment mode, all nodes shown as active (no inactive differentiation)
            // Backend already sets lastActiveAt to now, but check mode to be safe
            if (mode === 'payment') return 'active'

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
        [mode]
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

                const size = 4 + Math.log2(getExternalNodeUsers(node)) * 2

                // Colors by type
                const colors: Record<string, string> = {
                    WALLET: '#FFC900', // secondary-1 (yellow)
                    BANK: '#90A8ED', // secondary-3 (blue)
                    MERCHANT: '#BA8BFF', // primary-4 (purple)
                }
                const fillColor = colors[node.externalType] || '#9CA3AF'

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
            const { mode: currentMode } = displaySettingsRef.current

            // Determine activity status for coloring
            // Note: Visibility filtering is done at data level, so hidden nodes never reach here
            const activityStatus = getUserActivityStatus(node, filter)

            // In user mode: all nodes same size (larger for cleaner display)
            // In other modes: size based on points
            let size: number
            if (currentMode === 'user') {
                size = 12 // Fixed size for user graph - all nodes equal
            } else {
                const baseSize = hasAccess ? 6 : 3
                const pointsMultiplier = Math.sqrt(getNodePoints(node)) / 10
                size = baseSize + Math.min(pointsMultiplier, 25)
            }

            // ===========================================
            // NODE STYLING: Fill + Outline are separate
            // ===========================================
            // In USER mode: All nodes same purple color (unified appearance)
            // In PAYMENT mode: Color by P2P activity (purple = has P2P, grey = no P2P)
            // In FULL mode: Color based on activity status
            // OUTLINE: Based on access/selection
            //   - Jailed (no app access): black (#000000)
            //   - Selected: golden (#fbbf24)
            //   - Normal: none
            // ===========================================

            let fillColor: string
            const { p2pActiveNodes: p2pNodes } = displaySettingsRef.current

            if (currentMode === 'user') {
                // User mode: all nodes same pink (primary-1 #FF90E8), fully opaque
                fillColor = 'rgb(255, 144, 232)' // primary-1
            } else if (currentMode === 'payment') {
                // Payment mode: color by P2P participation (sending or receiving)
                const hasP2PActivity = p2pNodes.has(node.id)
                fillColor = hasP2PActivity
                    ? 'rgba(255, 144, 232, 0.85)' // primary-1 for P2P active
                    : 'rgba(156, 163, 175, 0.5)' // Grey for no P2P
            } else if (!filter.enabled) {
                // No filter - simple active/inactive by access
                fillColor = hasAccess ? 'rgba(255, 144, 232, 0.85)' : 'rgba(156, 163, 175, 0.85)'
            } else {
                // Activity filter enabled - three states
                if (activityStatus === 'new') {
                    fillColor = 'rgba(144, 168, 237, 0.85)' // secondary-3 #90A8ED for new signups
                } else if (activityStatus === 'active') {
                    fillColor = 'rgba(255, 144, 232, 0.85)' // primary-1 for active
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
                        fillColor = 'rgba(80, 80, 80, 0.9)' // Very dark gray - <1 week
                    } else if (daysSinceActivity < 14) {
                        fillColor = 'rgba(100, 100, 100, 0.85)' // Dark gray - 1-2 weeks
                    } else if (daysSinceActivity < 28) {
                        fillColor = 'rgba(120, 120, 120, 0.8)' // Medium-dark - 2-4 weeks
                    } else if (daysSinceActivity < 56) {
                        fillColor = 'rgba(145, 145, 145, 0.7)' // Medium gray - 4-8 weeks
                    } else if (daysSinceActivity < 112) {
                        fillColor = 'rgba(170, 170, 170, 0.6)' // Medium-light - 8-16 weeks
                    } else if (daysSinceActivity < 224) {
                        fillColor = 'rgba(195, 195, 195, 0.5)' // Light gray - 16-32 weeks
                    } else if (daysSinceActivity < 448) {
                        fillColor = 'rgba(215, 215, 215, 0.4)' // Very light - 32-64 weeks
                    } else {
                        fillColor = 'rgba(235, 235, 235, 0.3)' // Almost invisible - 64+ weeks
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
                ctx.strokeStyle = '#FFC900'
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
                const { inviterNodes: inviterNodesSet } = displaySettingsRef.current
                const isInviter = inviterNodesSet && inviterNodesSet.has(node.id)

                ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillStyle = activityStatus === 'inactive' && filter.enabled ? 'rgba(17, 24, 39, 0.3)' : '#111827'

                const labelY = node.y + size + fontSize + 2

                // Render username
                ctx.fillText(label, node.x, labelY)

                // Add heart icon for inviters in minimal/user mode
                if (minimal && isInviter) {
                    // Measure text to position heart after it
                    const textWidth = ctx.measureText(label).width
                    const heartX = node.x + textWidth / 2 + fontSize * 0.6
                    const heartY = labelY
                    const heartSize = fontSize * 0.7

                    // Draw simple heart shape (pink/magenta)
                    ctx.save()
                    ctx.fillStyle = '#FF90E8'
                    ctx.beginPath()
                    // Heart shape using two circles and a triangle
                    const topY = heartY - heartSize * 0.3
                    ctx.arc(heartX - heartSize * 0.25, topY, heartSize * 0.3, 0, Math.PI, true)
                    ctx.arc(heartX + heartSize * 0.25, topY, heartSize * 0.3, 0, Math.PI, true)
                    ctx.lineTo(heartX + heartSize * 0.5, topY)
                    ctx.lineTo(heartX, heartY + heartSize * 0.3)
                    ctx.lineTo(heartX - heartSize * 0.5, topY)
                    ctx.closePath()
                    ctx.fill()
                    ctx.restore()
                }
            }

            // Render "+1" popups for particle arrivals in user mode
            // currentMode is already defined above, reuse it
            if (currentMode === 'user' && minimal) {
                const now = performance.now()
                const popupDuration = 1500 // 1.5 seconds
                const arrivals = particleArrivalsRef.current

                // Clean up old arrivals and render active ones
                const toDelete: string[] = []
                arrivals.forEach((arrival, linkId) => {
                    const age = now - arrival.timestamp
                    if (age > popupDuration) {
                        toDelete.push(linkId)
                    } else {
                        // Render popup with fade-out - start from node center, rise up
                        const progress = age / popupDuration
                        const alpha = 1 - progress
                        const yOffset = -progress * 15 // Rise up 15px from node center

                        ctx.save()
                        ctx.globalAlpha = alpha
                        ctx.font = 'bold 5px Inter, system-ui, -apple-system, sans-serif'
                        ctx.fillStyle = '#fbbf24' // Gold color
                        ctx.textAlign = 'center'
                        ctx.textBaseline = 'middle'
                        ctx.fillText('+1 point', arrival.x, arrival.y + yOffset)
                        ctx.restore()
                    }
                })

                // Clean up expired arrivals
                toDelete.forEach((linkId) => arrivals.delete(linkId))
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
            // EXTERNAL LINK RENDERING (with animated particles scaling by volume/count)
            // ============================================
            if (link.isExternal) {
                // Get target node type for color
                const extType = target.externalType || 'WALLET'
                const lineColors: Record<string, string> = {
                    WALLET: 'rgba(255, 201, 0, 0.25)', // secondary-1
                    BANK: 'rgba(144, 168, 237, 0.25)', // secondary-3
                    MERCHANT: 'rgba(186, 139, 255, 0.25)', // primary-4
                }
                const particleColors: Record<string, string> = {
                    WALLET: 'rgba(255, 201, 0, 0.8)', // secondary-1
                    BANK: 'rgba(144, 168, 237, 0.8)', // secondary-3
                    MERCHANT: 'rgba(186, 139, 255, 0.8)', // primary-4
                }

                // Convert frequency/volume labels to numeric values for rendering
                // Full mode: use actual values; Anonymized mode: map labels to ranges
                const frequencyMap = { rare: 1, occasional: 3, regular: 10, frequent: 30 }
                const volumeMap = { small: 50, medium: 500, large: 5000, whale: 50000 }

                const txCount = link.txCount ?? frequencyMap[link.frequency as keyof typeof frequencyMap] ?? 1
                const usdVolume = link.totalUsd ?? volumeMap[link.volume as keyof typeof volumeMap] ?? 50

                // Scale line width by transaction count (same formula as P2P)
                const lineWidth = Math.min(0.4 + txCount * 0.25, 3.0)

                // Draw base line
                ctx.strokeStyle = lineColors[extType] || 'rgba(156, 163, 175, 0.25)'
                ctx.lineWidth = lineWidth
                ctx.beginPath()
                ctx.moveTo(source.x, source.y)
                ctx.lineTo(target.x, target.y)
                ctx.stroke()

                // Animated particles with direction based on actual fund flow
                const time = performance.now()
                // Logarithmic scaling for better visual distinction
                const logTxCount = Math.log10(Math.max(txCount, 1) + 1)
                const logUsd = Math.log10(Math.max(usdVolume, 1) + 1)

                // Speed: 0.0002 (1tx) → 0.0008 (100tx) using log scale
                const baseSpeed = 0.0002 + logTxCount * 0.0003
                const speed = baseSpeed

                // Particle count: 1 → 4 particles, log-scaled
                const particleCount = Math.min(1 + Math.floor(logTxCount * 1.5), 4)
                // Size: 1.5 (small) → 6.0 (large), log-scaled by USD volume
                const particleSize = 1.5 + logUsd * 2.25

                ctx.fillStyle = particleColors[extType] || 'rgba(107, 114, 128, 0.8)'

                // Determine particle direction based on fund flow
                const isIncoming = link.direction === 'INCOMING'

                // Draw particles along the edge
                for (let i = 0; i < particleCount; i++) {
                    const t = (time * speed + i / particleCount) % 1
                    // OUTGOING: flow from source (user) to target (external) → t goes 0→1
                    // INCOMING: flow from target (external) to source (user) → t goes 1→0 (use 1-t)
                    const progress = isIncoming ? 1 - t : t
                    const px = source.x + dx * progress
                    const py = source.y + dy * progress
                    ctx.beginPath()
                    ctx.arc(px, py, particleSize, 0, 2 * Math.PI)
                    ctx.fill()
                }

                return
            }

            if (link.isP2P) {
                // P2P: Draw line with animated particles (scaled by activity & volume)
                // Supports both full mode (count/totalUsd) and anonymized mode (frequency/volume labels)
                const baseAlpha = inactive ? 0.08 : 0.25
                ctx.strokeStyle = `rgba(144, 168, 237, ${baseAlpha})`

                // Convert frequency/volume labels to numeric values for rendering
                // Full mode: use actual values; Anonymized mode: map labels to ranges
                const frequencyMap = { rare: 1, occasional: 3, regular: 10, frequent: 30 }
                const volumeMap = { small: 50, medium: 500, large: 5000, whale: 50000 }

                const txCount = link.count ?? frequencyMap[link.frequency as keyof typeof frequencyMap] ?? 1
                const usdVolume = link.totalUsd ?? volumeMap[link.volume as keyof typeof volumeMap] ?? 50

                // Line width: 0.4 (min) → 3.0 (max) based on tx count
                ctx.lineWidth = Math.min(0.4 + txCount * 0.25, 3.0)
                ctx.beginPath()
                ctx.moveTo(source.x, source.y)
                ctx.lineTo(target.x, target.y)
                ctx.stroke()

                // Animated particles for P2P
                if (!inactive) {
                    const time = performance.now()
                    // Logarithmic scaling for better visual distinction
                    const logTxCount = Math.log10(Math.max(txCount, 1) + 1)
                    const logUsd = Math.log10(Math.max(usdVolume, 1) + 1)

                    // Particle count: 1 → 5 particles, log-scaled
                    const particleCount = Math.min(1 + Math.floor(logTxCount * 2), 5)
                    // Speed: 0.0003 (1tx) → 0.001 (100tx) using log scale
                    const baseSpeed = 0.0003 + logTxCount * 0.00035
                    const speed = baseSpeed

                    // Size: 1.5 (small) → 6.0 (large), log-scaled by USD volume
                    const particleSize = 1.5 + logUsd * 2.25
                    const isBidirectional = link.bidirectional === true

                    ctx.fillStyle = 'rgba(144, 168, 237, 0.85)'

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
                const baseColor = isDirect ? [255, 144, 232] : [186, 139, 255]
                const alpha = inactive ? 0.12 : 0.35
                const arrowAlpha = inactive ? 0.2 : 0.6
                const { mode: currentMode } = displaySettingsRef.current

                // Draw main line
                ctx.strokeStyle = `rgba(${baseColor.join(',')}, ${alpha})`
                ctx.lineWidth = isDirect ? 1 : 0.8
                ctx.beginPath()
                ctx.moveTo(source.x, source.y)
                ctx.lineTo(target.x, target.y)
                ctx.stroke()

                // In user mode: Draw animated points flowing UP the tree (invitee → inviter)
                // This visualizes "points flowing to the inviter"
                if (currentMode === 'user' && !inactive) {
                    const time = performance.now()
                    // Slow, pulsing animation - slower than P2P
                    const baseSpeed = 0.00015
                    const particleCount = 3
                    const particleSize = 3

                    // Gold color for points
                    ctx.fillStyle = 'rgba(255, 201, 0, 0.9)' // secondary-1 #FFC900 with alpha

                    for (let i = 0; i < particleCount; i++) {
                        // Flow direction: source → target (invitee → inviter)
                        // Note: Edges are REVERSED for graph rendering (see graphData mapping)
                        // After reversal: link.source = invitee, link.target = inviter
                        // So particles flow from source (invitee) to target (inviter)
                        const t = (time * baseSpeed + i / particleCount) % 1
                        const px = source.x + (target.x - source.x) * t
                        const py = source.y + (target.y - source.y) * t

                        // Detect arrival: when particle is close to target (t > 0.95)
                        // Track arrival to show "+1 pt" popup
                        if (t > 0.95 && t < 0.99) {
                            const linkId = `${link.source.id}_${link.target.id}_${i}`
                            const arrivals = particleArrivalsRef.current
                            if (!arrivals.has(linkId)) {
                                arrivals.set(linkId, {
                                    timestamp: time,
                                    x: target.x,
                                    y: target.y,
                                    nodeId: link.target.id,
                                })
                            }
                        }

                        ctx.beginPath()
                        ctx.arc(px, py, particleSize, 0, 2 * Math.PI)
                        ctx.fill()
                    }
                } else {
                    // Full/Payment mode: Draw arrows along the line (every ~60px, minimum 2)
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

            // User mode: Navigate to user profile in new tab
            if (isMinimal && node.username) {
                window.open(`/${node.username}`, '_blank')
                return
            }

            // Full/Payment mode: User node → Select (camera follows) - click again to open Grafana
            if (selectedUserId === node.id) {
                // Already selected - open Grafana
                const username = node.username || node.id
                window.open(
                    `https://teampeanut.grafana.net/d/ad31f645-81ca-4779-bfb2-bff8e03d9057/explore-peanut-wallet-user?orgId=1&var-GRAFANA_VAR_Username=${encodeURIComponent(username)}`,
                    '_blank'
                )
            } else {
                // Select node
                setSelectedUserId(node.id)
            }
        },
        [selectedUserId, isMinimal]
    )

    // Right-click selects the node (camera follows)
    const handleNodeRightClick = useCallback((node: any) => {
        // External nodes can be selected for camera zoom but don't open Grafana
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

            if (!rawGraphData || !query.trim()) {
                setSearchResults([])
                return
            }

            // Debounce the actual search by 150ms
            searchTimeoutRef.current = setTimeout(() => {
                const lowerQuery = query.toLowerCase()
                const results: any[] = []

                // Search user nodes
                if (rawGraphData) {
                    const userResults = rawGraphData.nodes.filter(
                        (node) => node.username && node.username.toLowerCase().includes(lowerQuery)
                    )
                    results.push(...userResults.map((n) => ({ ...n, isExternal: false, displayName: n.username })))
                }

                // Search external nodes (by label and ID)
                if (externalNodesConfig.enabled && filteredExternalNodes.length > 0) {
                    const externalResults = filteredExternalNodes.filter(
                        (node) =>
                            node.label.toLowerCase().includes(lowerQuery) || node.id.toLowerCase().includes(lowerQuery)
                    )
                    results.push(
                        ...externalResults.map((n) => ({
                            id: `ext_${n.id}`,
                            isExternal: true,
                            displayName: n.label,
                            externalType: n.type,
                            uniqueUsers: n.uniqueUsers,
                            totalUsd: n.totalUsd,
                        }))
                    )
                }

                setSearchResults(results)

                if (results.length === 1) {
                    setSelectedUserId(results[0].id)
                }
            }, 150)
        },
        [rawGraphData, filteredExternalNodes, externalNodesConfig.enabled]
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
                        const pointsMultiplier = 1 + Math.sqrt(getNodePoints(node)) / 100
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
                    const size = 4 + Math.log2(getExternalNodeUsers(node)) * 2
                    return size * 1.5
                }
                // User nodes: size based on points
                const baseSize = node.hasAppAccess ? 6 : 3
                const pointsMultiplier = Math.sqrt(getNodePoints(node)) / 10
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
                    const pointsMultiplier = Math.min(Math.sqrt(getNodePoints(node)) / 100, 1)
                    return centerConfig.strength * (1 + centerConfig.sizeBias * pointsMultiplier)
                })
            )
            graph.d3Force(
                'y',
                d3.forceY(0).strength((node: any) => {
                    if (node.isExternal) return centerConfig.strength * 0.5
                    const pointsMultiplier = Math.min(Math.sqrt(getNodePoints(node)) / 100, 1)
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
            return
        }

        const graph = graphRef.current as any

        // Get nodes from graphData prop or via d3Force
        const linkForce = graph.d3Force?.('link')
        const nodes =
            linkForce?.links?.()?.flatMap?.((l: any) => [l.source, l.target]) ||
            filteredGraphDataRef.current?.nodes ||
            []
        const uniqueNodes = [...new Map(nodes.map((n: any) => [n.id || n, n])).values()]

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

            // configureForces is async - must wait for it to complete before reheating
            configureForces().then(() => {
                if (!graphRef.current) return
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const internalGraph = graphRef.current as any
                if (internalGraph._simulation) {
                    internalGraph._simulation.alpha(1).restart()
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

    // Continuous zoom tracking in minimal mode during simulation settling
    useEffect(() => {
        if (!isMinimal || !filteredGraphData || !graphRef.current) return

        let frameId: number | null = null
        const startTime = Date.now()
        const trackDuration = 4000 // Track for 4 seconds (simulation should settle by then)

        const continuousZoom = () => {
            const elapsed = Date.now() - startTime
            if (elapsed > trackDuration || !graphRef.current) return

            // Zoom to fit every frame during settling - fast animation
            graphRef.current.zoomToFit(100, 40)
            frameId = requestAnimationFrame(continuousZoom)
        }

        // Start tracking immediately after graph mounts
        const timeout = setTimeout(() => {
            frameId = requestAnimationFrame(continuousZoom)
        }, 100)

        return () => {
            if (frameId) cancelAnimationFrame(frameId)
            clearTimeout(timeout)
        }
    }, [isMinimal, filteredGraphData])

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

    // Debug: Build combined links and log what's being passed to ForceGraph2D
    const combinedLinks = useMemo(() => {
        if (!filteredGraphData) return []

        const inviteLinks = filteredGraphData.edges.map((edge) => ({
            ...edge,
            source: edge.target,
            target: edge.source,
            isP2P: false,
            isExternal: false,
        }))

        const p2pLinks = (filteredGraphData.p2pEdges || []).map((edge, i) => ({
            id: `p2p-${i}`,
            source: edge.source,
            target: edge.target,
            type: edge.type,
            count: edge.count,
            totalUsd: edge.totalUsd,
            frequency: edge.frequency,
            volume: edge.volume,
            bidirectional: edge.bidirectional,
            isP2P: true,
            isExternal: false,
        }))

        const allLinks = [...inviteLinks, ...p2pLinks, ...externalLinks]

        return allLinks
    }, [filteredGraphData, externalLinks])

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
                                    // P2P payment edges (for clustering visualization)
                                    // Include both full mode (count/totalUsd) and anonymized mode (frequency/volume) fields
                                    ...(filteredGraphData.p2pEdges || []).map((edge, i) => ({
                                        id: `p2p-${i}`,
                                        source: edge.source,
                                        target: edge.target,
                                        type: edge.type,
                                        count: edge.count,
                                        totalUsd: edge.totalUsd,
                                        frequency: edge.frequency,
                                        volume: edge.volume,
                                        bidirectional: edge.bidirectional,
                                        isP2P: true,
                                    })),
                                ],
                            }}
                            nodeId="id"
                            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                                // Draw hit detection area matching actual rendered node size
                                // In user mode (minimal): fixed size of 12
                                const nodeRadius = 12
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
                            d3AlphaDecay={isMinimal ? 0.03 : 0.005}
                            d3VelocityDecay={isMinimal ? 0.8 : 0.6}
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
                        topNodes,
                        setTopNodes,
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
                        <h1 className="text-lg font-bold text-gray-900">
                            {mode === 'payment' ? 'Payment Network' : 'Invite Network'}
                        </h1>
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
                                {/* In payment mode, show P2P edges; in other modes, show invite edges */}
                                {(mode === 'payment'
                                    ? filteredGraphData.stats.totalP2PEdges
                                    : filteredGraphData.stats.totalEdges) + externalLinks.length}{' '}
                                edges
                                {externalNodesConfig.enabled && externalLinks.length > 0 && (
                                    <span className="ml-1 text-orange-600">(+{externalLinks.length} ext)</span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Right side - empty, controls are in sidebar overlay */}
                </div>

                {/* Second Row: Search (hidden in payment mode - no usernames) */}
                {mode !== 'payment' && (
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
                                {searchResults.map((node: any) => (
                                    <button
                                        key={node.id}
                                        onClick={() => {
                                            setSelectedUserId(node.id)
                                            handleClearSearch()
                                        }}
                                        className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors ${
                                            node.isExternal ? 'hover:bg-orange-50' : 'hover:bg-purple-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {node.isExternal && (
                                                <span className="text-xs">
                                                    {node.externalType === 'WALLET'
                                                        ? '💳'
                                                        : node.externalType === 'BANK'
                                                          ? '🏦'
                                                          : '🏪'}
                                                </span>
                                            )}
                                            <span className="font-medium text-gray-900">{node.displayName}</span>
                                        </div>
                                        <span className="text-xs text-gray-500">
                                            {node.isExternal
                                                ? node.totalUsd
                                                    ? `${node.uniqueUsers} users, $${node.totalUsd.toFixed(0)}`
                                                    : `${node.size || node.volume || 'N/A'}`
                                                : node.totalPoints
                                                  ? `${node.totalPoints.toLocaleString()} pts`
                                                  : node.size || 'N/A'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Selected User/Node Banner */}
                {selectedUserId && (
                    <div
                        className={`border-t px-4 py-2 text-sm ${
                            selectedUserId.startsWith('ext_')
                                ? 'border-orange-100 bg-orange-50'
                                : 'border-purple-100 bg-purple-50'
                        }`}
                    >
                        <span className={selectedUserId.startsWith('ext_') ? 'text-orange-700' : 'text-purple-700'}>
                            Focused on:{' '}
                            <span className="font-bold">
                                {selectedUserId.startsWith('ext_')
                                    ? filteredExternalNodes.find((n) => `ext_${n.id}` === selectedUserId)?.label ||
                                      selectedUserId.replace('ext_', '')
                                    : filteredGraphData.nodes.find((n) => n.id === selectedUserId)?.username ||
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
                        links: combinedLinks,
                    }}
                    nodeId="id"
                    nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                        // Draw hit detection area matching actual rendered node size
                        let size: number
                        if (node.isExternal) {
                            size = 4 + Math.log2(getExternalNodeUsers(node)) * 2
                        } else {
                            const hasAccess = node.hasAppAccess
                            const baseSize = hasAccess ? 6 : 3
                            const pointsMultiplier = Math.sqrt(getNodePoints(node)) / 10
                            size = baseSize + Math.min(pointsMultiplier, 25)
                        }
                        ctx.fillStyle = color
                        ctx.beginPath()
                        ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI) // +2 for easier hover
                        ctx.fill()
                    }}
                    nodeLabel={(node: any) => {
                        const currentMode = displaySettingsRef.current.mode
                        const isAnonymized = currentMode === 'payment'

                        // External node tooltip
                        if (node.isExternal) {
                            const fullId = node.id.replace('ext_', '')
                            const typeLabel =
                                node.externalType === 'WALLET'
                                    ? '💳 Wallet'
                                    : node.externalType === 'BANK'
                                      ? `🏦 ${inferBankAccountType(fullId)}`
                                      : '🏪 Merchant'

                            // Show only masked labels for all types
                            const displayLabel = node.externalType === 'BANK' ? 'Account' : 'ID'

                            // Anonymized mode: show qualitative labels instead of exact values
                            if (isAnonymized) {
                                // In payment mode, uniqueUsers is not sent - use size label or userIds count
                                const userCount = node.uniqueUsers ?? (node.userIds?.length || 0)
                                const userDisplay = node.size || userCount

                                return `<div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; font-family: Inter, system-ui, sans-serif; max-width: 280px; padding: 12px 14px;">
                                    <div style="font-weight: 700; margin-bottom: 8px; font-size: 14px; color: #1f2937;">${typeLabel}</div>
                                    <div style="font-size: 12px; line-height: 1.6; color: #6b7280;">
                                        <div style="margin-bottom: 4px; word-break: break-all;">🏷️ ${displayLabel}: <span style="color: #374151; font-weight: 600;">${node.label}</span></div>
                                        <div style="margin-bottom: 4px;">👥 Users: <span style="color: #374151;">${userDisplay}</span></div>
                                        <div style="margin-bottom: 4px;">📊 Activity: <span style="color: #374151;">${node.frequency || 'N/A'}</span></div>
                                        <div>💵 Volume: <span style="color: #374151;">${node.volume || 'N/A'}</span></div>
                                    </div>
                                </div>`
                            }

                            return `<div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; font-family: Inter, system-ui, sans-serif; max-width: 280px; padding: 12px 14px;">
                                <div style="font-weight: 700; margin-bottom: 8px; font-size: 14px; color: #1f2937;">${typeLabel}</div>
                                <div style="font-size: 12px; line-height: 1.6; color: #6b7280;">
                                    <div style="margin-bottom: 4px; word-break: break-all;">🏷️ ${displayLabel}: <span style="color: #374151; font-weight: 600;">${node.label}</span></div>
                                    <div style="margin-bottom: 4px;">👥 Users: <span style="color: #374151;">${node.uniqueUsers ?? (node.userIds?.length || 0)}</span></div>
                                    <div style="margin-bottom: 4px;">📊 Transactions: <span style="color: #374151;">${node.txCount ?? 'N/A'}</span></div>
                                    <div>💵 Volume: <span style="color: #374151;">$${(node.totalUsd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                                </div>
                            </div>`
                        }

                        // User node tooltip - anonymized in payment mode (minimal, no status)
                        if (isAnonymized) {
                            return `<div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; font-family: Inter, system-ui, sans-serif; max-width: 240px; padding: 12px 14px; box-shadow: none;">
                                <div style="font-weight: 700; font-size: 14px; color: #1f2937; font-family: monospace;">${node.username || 'User'}</div>
                            </div>`
                        }

                        // Full mode: show all details
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
                                ${
                                    node.totalPoints
                                        ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px;">
                                    ${node.totalPoints.toLocaleString()} pts (${node.directPoints} direct, ${node.transitivePoints} trans)
                                </div>`
                                        : ''
                                }
                            </div>
                        </div>`
                    }}
                    nodeCanvasObject={nodeCanvasObject}
                    nodeCanvasObjectMode={() => 'replace'}
                    linkLabel={(link: any) => {
                        if (link.isP2P) {
                            // Handle both full (count/totalUsd) and anonymized (frequency/volume) modes
                            if (link.frequency && link.volume) {
                                return `P2P: ${link.frequency} activity, ${link.volume} volume`
                            }
                            return `P2P: ${link.count} txs ($${link.totalUsd?.toFixed(2) ?? '0'})`
                        }
                        if (link.isExternal) {
                            // Handle both full and anonymized modes
                            if (link.frequency && link.volume) {
                                return `Merchant: ${link.frequency} activity, ${link.volume} volume`
                            }
                            return `External: ${link.txCount} txs ($${link.totalUsd?.toFixed(2) ?? '0'})`
                        }
                        return `${link.type} - ${new Date(link.createdAt).toLocaleDateString()}`
                    }}
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
                    backgroundColor="#FAF4F0"
                    width={graphWidth}
                    height={graphHeight}
                    autoPauseRedraw={false}
                />

                {/* Render overlays (legend, mobile controls) via render prop */}
                {renderOverlays?.({
                    showUsernames,
                    setShowUsernames,
                    topNodes,
                    setTopNodes,
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
