import type { ExplorerFilters, ExplorerNode, ExplorerRelationship, P2PEdge } from './types'

/**
 * The backend aggregates p2pEdges over this fixed window. Label only — there is no time filter.
 *
 * Deliberately does NOT claim "completed only": p2pEdges.sql filters on COMPLETED for the
 * send-link and request-payment arms, but its CRYPTO_DEPOSIT (direct transfer) arm has no
 * status predicate, so a pending or stuck deposit can be counted.
 */
export const FIXED_WINDOW_LABEL = 'Last 120 days of payment activity'

export const DEFAULT_TOP_NODES = 5000
/** 0 = no server limit: the entire user base is serialized. Keep behind an explicit choice. */
export const TOP_NODES_OPTIONS = [500, 1000, 5000, 0] as const
const INCLUDE_NEW_DAYS = 30

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{1,40}$/

export function defaultExplorerFilters(): ExplorerFilters {
    return {
        view: 'graph',
        types: [],
        direction: 'all',
        minCount: 0,
        minUsd: 0,
        topNodes: DEFAULT_TOP_NODES,
        focus: null,
    }
}

export function isPlainUsername(value: string | null | undefined): value is string {
    return !!value && USERNAME_PATTERN.test(value)
}

/** The only server-side controls are mode, topNodes and includeNewDays. */
export function buildGraphEndpoint(topNodes: number): string {
    const params = new URLSearchParams({ mode: 'full' })
    if (topNodes > 0) params.set('topNodes', String(topNodes))
    params.set('includeNewDays', String(INCLUDE_NEW_DAYS))
    return `/invites/graph?${params.toString()}`
}

export function relationshipId(edge: P2PEdge): string {
    return `${edge.source}:${edge.target}:${edge.type}`
}

export function toRelationships(edges: readonly P2PEdge[]): ExplorerRelationship[] {
    return edges.map((edge) => ({ ...edge, id: relationshipId(edge) }))
}

/** All v1 filters run client-side over the pre-aggregated p2p edges. */
export function filterRelationships(
    relationships: readonly ExplorerRelationship[],
    filters: Pick<ExplorerFilters, 'types' | 'direction' | 'minCount' | 'minUsd'>
): ExplorerRelationship[] {
    const types = filters.types.length > 0 ? new Set(filters.types) : null
    return relationships.filter((relationship) => {
        if (types && !types.has(relationship.type)) return false
        if (filters.direction === 'oneWay' && relationship.bidirectional) return false
        if (filters.direction === 'bidirectional' && !relationship.bidirectional) return false
        if (relationship.count < filters.minCount) return false
        if (relationship.totalUsd < filters.minUsd) return false
        return true
    })
}

export function findNodeByUsername(nodes: readonly ExplorerNode[], username: string): ExplorerNode | null {
    const query = username.trim().toLowerCase()
    if (!query) return null
    // username is nullable in the DB and the endpoint serializes it verbatim.
    return nodes.find((node) => node.username?.toLowerCase() === query) ?? null
}

type LegacyLocation = Pick<Location, 'href'>
type LegacyHistory = Pick<History, 'replaceState' | 'state'>

/** Legacy graph links carried a shared password in the URL. Scrub it before anything renders. */
export function scrubLegacyGraphPassword(location: LegacyLocation, history: LegacyHistory): void {
    const url = new URL(location.href)
    if (!url.searchParams.has('password')) return
    url.searchParams.delete('password')
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
}
