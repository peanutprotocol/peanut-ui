import { type GraphData, type GraphNode } from './types'

// Constants for drag vs click detection
export const CLICK_MAX_DURATION_MS = 200
export const CLICK_MAX_DISTANCE_PX = 5

/** More nodes than this make the rewards card slow; the top nodes by points are kept. */
export const MAX_NODES = 200

/** A user who signed up or transacted within this many days counts as new or active. */
export const ACTIVITY_WINDOW_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export function getNodePoints(node: { totalPoints?: number }): number {
    return node.totalPoints || 0
}

/**
 * Prepare the user's invite tree for drawing: keep the top MAX_NODES nodes by
 * points, keep only invite edges between kept nodes, and drop P2P edges.
 */
export function toUserGraphData(data: GraphData): GraphData {
    const nodes =
        data.nodes.length > MAX_NODES
            ? [...data.nodes].sort((a, b) => getNodePoints(b) - getNodePoints(a)).slice(0, MAX_NODES)
            : data.nodes
    const nodeIds = new Set(nodes.map((n) => n.id))
    const edges = data.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))

    return {
        nodes,
        edges,
        p2pEdges: [],
        stats: {
            totalNodes: nodes.length,
            totalEdges: edges.length,
            totalP2PEdges: 0,
            usersWithAccess: nodes.filter((n) => n.hasAppAccess).length,
            orphans: nodes.filter((n) => !n.hasAppAccess).length,
        },
    }
}

/** New: signed up within the window. Active: transacted within it. Inactive: neither. */
export function getUserActivityStatus(
    node: Pick<GraphNode, 'createdAt' | 'lastActiveAt'>,
    now: number = Date.now()
): 'new' | 'active' | 'inactive' {
    const activityCutoff = now - ACTIVITY_WINDOW_DAYS * DAY_MS
    const createdAtMs = node.createdAt ? new Date(node.createdAt).getTime() : 0
    if (createdAtMs >= activityCutoff) return 'new'
    if (node.lastActiveAt && new Date(node.lastActiveAt).getTime() >= activityCutoff) return 'active'
    return 'inactive'
}
