import { getNodePoints, getUserActivityStatus, MAX_NODES, toUserGraphData } from '../utils'
import { type GraphData, type GraphNode } from '../types'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 4)

function node(id: string, overrides: Partial<GraphNode> = {}): GraphNode {
    return { id, username: id, hasAppAccess: true, kycRegions: null, ...overrides }
}

function graph(nodes: GraphNode[], edges: Array<[string, string]>): GraphData {
    return {
        nodes,
        edges: edges.map(([source, target], i) => ({
            id: `e${i}`,
            source,
            target,
            type: 'DIRECT',
            createdAt: '2026-01-01T00:00:00Z',
        })),
        p2pEdges: [{ source: 'a', target: 'b', type: 'SEND_LINK', bidirectional: false, count: 1, totalUsd: 5 }],
        stats: { totalNodes: 0, totalEdges: 0, totalP2PEdges: 1, usersWithAccess: 0, orphans: 0 },
    }
}

describe('getNodePoints', () => {
    it('uses totalPoints', () => {
        expect(getNodePoints({ totalPoints: 1234 })).toBe(1234)
    })

    it('falls back to 0 when totalPoints is missing', () => {
        expect(getNodePoints({})).toBe(0)
    })
})

describe('toUserGraphData', () => {
    it('keeps a small graph whole, drops P2P edges, and recounts stats', () => {
        const result = toUserGraphData(graph([node('a'), node('b', { hasAppAccess: false })], [['a', 'b']]))

        expect(result.nodes.map((n) => n.id)).toEqual(['a', 'b'])
        expect(result.edges).toHaveLength(1)
        expect(result.p2pEdges).toEqual([])
        expect(result.stats).toEqual({
            totalNodes: 2,
            totalEdges: 1,
            totalP2PEdges: 0,
            usersWithAccess: 1,
            orphans: 1,
        })
    })

    it('keeps the top nodes by points and only the edges between them', () => {
        const nodes = Array.from({ length: MAX_NODES + 1 }, (_, i) => node(`n${i}`, { totalPoints: i }))
        const result = toUserGraphData(
            graph(nodes, [
                ['n0', 'n1'],
                ['n1', 'n2'],
                [`n${MAX_NODES}`, 'n2'],
            ])
        )

        expect(result.nodes).toHaveLength(MAX_NODES)
        expect(result.nodes.some((n) => n.id === 'n0')).toBe(false)
        expect(result.edges.map((e) => [e.source, e.target])).toEqual([
            ['n1', 'n2'],
            [`n${MAX_NODES}`, 'n2'],
        ])
    })
})

describe('getUserActivityStatus', () => {
    it('is new when the user signed up within 30 days', () => {
        expect(getUserActivityStatus({ createdAt: new Date(NOW - 5 * DAY_MS).toISOString() }, NOW)).toBe('new')
    })

    it('is active when an older user transacted within 30 days', () => {
        const status = getUserActivityStatus(
            {
                createdAt: new Date(NOW - 100 * DAY_MS).toISOString(),
                lastActiveAt: new Date(NOW - 2 * DAY_MS).toISOString(),
            },
            NOW
        )
        expect(status).toBe('active')
    })

    it('is inactive otherwise', () => {
        const status = getUserActivityStatus(
            {
                createdAt: new Date(NOW - 100 * DAY_MS).toISOString(),
                lastActiveAt: new Date(NOW - 40 * DAY_MS).toISOString(),
            },
            NOW
        )
        expect(status).toBe('inactive')
        expect(getUserActivityStatus({}, NOW)).toBe('inactive')
    })
})
