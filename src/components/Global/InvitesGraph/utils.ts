import {
    type ActivityFilter,
    type ExternalNodesConfig,
    type ForceConfig,
    type GraphMode,
    type SizeLabel,
    type VisibilityConfig,
    DEFAULT_EXTERNAL_NODES_CONFIG,
    DEFAULT_FORCE_CONFIG,
} from './types'

// Constants for drag vs click detection
export const CLICK_MAX_DURATION_MS = 200
export const CLICK_MAX_DISTANCE_PX = 5

// Default top nodes limit (0 = all nodes, backend-filtered)
export const DEFAULT_TOP_NODES = 5000

// Helper to convert qualitative size labels to numeric points for graph calculations
// Used in payment mode where real points aren't sent to frontend
export function sizeLabelToPoints(size: SizeLabel | undefined): number {
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
export function getNodePoints(node: any): number {
    // Payment mode: node has size label instead of totalPoints
    if (node.size && !node.totalPoints) {
        return sizeLabelToPoints(node.size)
    }
    // Full mode: use real totalPoints
    return node.totalPoints || 0
}

// Helper to get effective unique users count for external nodes
export function getExternalNodeUsers(node: any): number {
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

/**
 * Mode-specific defaults (pure derivation, computed every render like the original inline code)
 * Payment mode: 120-day fixed window, no invite edges
 * User mode: invite edges only (no P2P), used for points animation
 */
export function getModeConfigs({
    mode,
    initialActivityFilter,
    initialForceConfig,
    initialVisibilityConfig,
}: {
    mode: GraphMode
    initialActivityFilter: ActivityFilter
    initialForceConfig: ForceConfig
    initialVisibilityConfig: VisibilityConfig
}): {
    modeActivityFilter: ActivityFilter
    modeVisibilityConfig: VisibilityConfig
    finalModeForceConfig: ForceConfig
    modeExternalNodesConfig: ExternalNodesConfig
} {
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

    return { modeActivityFilter, modeVisibilityConfig, finalModeForceConfig, modeExternalNodesConfig }
}
