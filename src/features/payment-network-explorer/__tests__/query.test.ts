import {
    buildGraphEndpoint,
    defaultExplorerFilters,
    filterRelationships,
    findNodeByUsername,
    isPlainUsername,
    relationshipId,
    scrubLegacyGraphPassword,
    toRelationships,
} from '../query'
import type { ExplorerNode, P2PEdge } from '../types'

function edge(overrides: Partial<P2PEdge> = {}): P2PEdge {
    return {
        source: 'a',
        target: 'b',
        type: 'SEND_LINK',
        count: 3,
        totalUsd: 25,
        bidirectional: false,
        ...overrides,
    }
}

function node(id: string, username: string): ExplorerNode {
    return {
        id,
        username,
        hasAppAccess: true,
        directPoints: 0,
        transitivePoints: 0,
        totalPoints: 0,
        createdAt: null,
        lastActiveAt: null,
        kycRegions: null,
    }
}

describe('payment explorer query contract', () => {
    it('serializes only the supported server params', () => {
        expect(buildGraphEndpoint(5000)).toBe('/invites/graph?mode=full&topNodes=5000&includeNewDays=30')
        expect(buildGraphEndpoint(0)).toBe('/invites/graph?mode=full&includeNewDays=30')
    })

    it('defaults to the safe 5k top-users cap and no client filters', () => {
        expect(defaultExplorerFilters()).toEqual({
            view: 'graph',
            types: [],
            direction: 'all',
            minCount: 0,
            minUsd: 0,
            topNodes: 5000,
            focus: null,
        })
    })

    it('synthesizes a stable relationship id per directed pair and type', () => {
        expect(relationshipId(edge())).toBe('a:b:SEND_LINK')
        const [relationship] = toRelationships([edge({ type: 'DIRECT_TRANSFER' })])
        expect(relationship.id).toBe('a:b:DIRECT_TRANSFER')
        expect(relationship.count).toBe(3)
    })
})

describe('client-side edge filters', () => {
    const relationships = toRelationships([
        edge({ type: 'SEND_LINK', count: 1, totalUsd: 5 }),
        edge({ source: 'b', target: 'c', type: 'REQUEST_PAYMENT', count: 10, totalUsd: 500, bidirectional: true }),
        edge({ source: 'c', target: 'a', type: 'DIRECT_TRANSFER', count: 4, totalUsd: 40 }),
    ])

    it('passes everything through with default filters', () => {
        expect(filterRelationships(relationships, defaultExplorerFilters())).toHaveLength(3)
    })

    it('filters by edge type set', () => {
        const result = filterRelationships(relationships, {
            ...defaultExplorerFilters(),
            types: ['SEND_LINK', 'DIRECT_TRANSFER'],
        })
        expect(result.map((item) => item.type)).toEqual(['SEND_LINK', 'DIRECT_TRANSFER'])
    })

    it('filters by direction using the honest bidirectional flag', () => {
        expect(
            filterRelationships(relationships, { ...defaultExplorerFilters(), direction: 'bidirectional' }).map(
                (item) => item.type
            )
        ).toEqual(['REQUEST_PAYMENT'])
        expect(filterRelationships(relationships, { ...defaultExplorerFilters(), direction: 'oneWay' })).toHaveLength(2)
    })

    it('applies minimum transaction count and minimum USD thresholds', () => {
        expect(filterRelationships(relationships, { ...defaultExplorerFilters(), minCount: 4 })).toHaveLength(2)
        expect(filterRelationships(relationships, { ...defaultExplorerFilters(), minUsd: 100 })).toHaveLength(1)
        expect(
            filterRelationships(relationships, { ...defaultExplorerFilters(), minCount: 4, minUsd: 100 })
        ).toHaveLength(1)
    })
})

describe('focus deep-link resolution', () => {
    const nodes = [node('n1', 'alice'), node('n2', 'Bob')]

    it('resolves a username case-insensitively after data arrives', () => {
        expect(findNodeByUsername(nodes, 'ALICE')?.id).toBe('n1')
        expect(findNodeByUsername(nodes, ' bob ')?.id).toBe('n2')
        expect(findNodeByUsername(nodes, 'carol')).toBeNull()
        expect(findNodeByUsername(nodes, '  ')).toBeNull()
    })

    it('accepts plain usernames and rejects token-shaped values', () => {
        expect(isPlainUsername('alice')).toBe(true)
        expect(isPlainUsername('a'.repeat(41))).toBe(false)
        expect(isPlainUsername('has space')).toBe(false)
        expect(isPlainUsername(null)).toBe(false)
    })
})

describe('legacy link hygiene', () => {
    it('scrubs a legacy shared password but keeps the plain user deep-link', () => {
        const history = { replaceState: jest.fn(), state: { marker: true } }
        scrubLegacyGraphPassword(
            { href: 'https://peanut.me/dev/payment-graph?user=alice&password=secret&top=500' },
            history
        )
        expect(history.replaceState).toHaveBeenCalledWith({ marker: true }, '', '/dev/payment-graph?user=alice&top=500')
    })

    it('does not rewrite history when no password is present', () => {
        const history = { replaceState: jest.fn(), state: null }
        scrubLegacyGraphPassword({ href: 'https://peanut.me/dev/payment-graph?user=alice' }, history)
        expect(history.replaceState).not.toHaveBeenCalled()
    })
})
