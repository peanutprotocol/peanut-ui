import { useMemo } from 'react'
import {
    type ActivityFilter,
    type ExternalNode,
    type ExternalNodesConfig,
    type GraphData,
    type GraphMode,
} from './types'
import { getExternalNodeUsers } from './utils'

interface UseInvitesGraphDerivedParams {
    filteredGraphData: GraphData | null
    rawGraphData: GraphData | null
    externalNodesData: ExternalNode[]
    externalNodesConfig: ExternalNodesConfig
    activityFilter: ActivityFilter
    mode: GraphMode
}

/**
 * Pure derived data: lookup maps/sets for rendering, filtered external nodes,
 * and the combined node/link arrays handed to ForceGraph2D.
 */
export function useInvitesGraphDerived({
    filteredGraphData,
    rawGraphData,
    externalNodesData,
    externalNodesConfig,
    activityFilter,
    mode,
}: UseInvitesGraphDerivedParams) {
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

    return {
        inviterMap,
        inviterNodes,
        p2pActiveNodes,
        filteredExternalNodes,
        combinedGraphNodes,
        externalLinks,
        combinedLinks,
    }
}
