import {
    buildGraphProjection,
    graphTableRelationshipParity,
    missingPrincipalMovementCount,
    movementStatesPresent,
    nodeIndex,
    rankDenseGraphOverview,
    settledEventCoveragePercent,
    sortRelationships,
} from '../selectors'
import type { ExplorerNode, ExplorerRelationship } from '../types'

function node(id: string, label = id, type: ExplorerNode['type'] = 'USER'): ExplorerNode {
    return { id, type, label, labelVisibility: 'VISIBLE', paymentCount: 1, overlayCount: 0, assets: [] }
}

function relationship(id: string, source: string, target: string): ExplorerRelationship {
    return {
        id,
        source,
        target,
        provider: 'PEANUT',
        method: 'P2P',
        rail: 'PEANUT_DIRECT',
        kind: 'TRANSFER',
        direction: 'OUTGOING',
        state: 'SETTLED',
        evidence: 'POSTED_PRINCIPAL',
        timeBasis: 'COMPLETED_AT',
        asset: { code: 'USDC:42161', displayCode: 'USDC', decimals: 6, chainId: '42161' },
        count: 2,
        settledPaymentCount: 2,
        nativeAmount: '1500000',
        overlayNativeAmount: null,
        firstAt: '2026-08-01T00:00:00.000Z',
        lastAt: '2026-08-02T00:00:00.000Z',
        bidirectional: false,
    }
}

describe('canonical graph projection', () => {
    it('keeps one direct visual link and the exact canonical relationship object', () => {
        const nodes = [node('a'), node('b')]
        const canonical = relationship('r1', 'a', 'b')
        const projection = buildGraphProjection(nodes, [canonical])
        expect(projection.links).toHaveLength(1)
        expect(projection.links[0].canonical).toBe(canonical)
        expect(projection.links[0].canonicalRelationshipId).toBe('r1')
        expect(graphTableRelationshipParity(projection.links, [canonical])).toBe(true)
    })

    it('splits a hub into visual segments without duplicating the logical relationship', () => {
        const nodes = [node('a'), node('b'), node('hub', 'Rhino', 'HUB')]
        const canonical = { ...relationship('r1', 'a', 'b'), infrastructureHubId: 'hub' }
        const projection = buildGraphProjection(nodes, [canonical])
        expect(projection.links).toHaveLength(2)
        expect(projection.links.map((link) => [link.source, link.target])).toEqual([
            ['a', 'hub'],
            ['hub', 'b'],
        ])
        expect(projection.links.every((link) => link.canonical === canonical)).toBe(true)
        expect(new Set(projection.links.map((link) => link.canonicalRelationshipId))).toEqual(new Set(['r1']))
        expect(graphTableRelationshipParity(projection.links, [canonical])).toBe(true)
    })

    it('detects missing or extra logical relationships across graph and table', () => {
        const first = relationship('r1', 'a', 'b')
        const second = relationship('r2', 'b', 'c')
        const projection = buildGraphProjection([node('a'), node('b'), node('c')], [first])
        expect(graphTableRelationshipParity(projection.links, [first, second])).toBe(false)
    })

    it('sorts canonical rows without mutating the response array', () => {
        const first = relationship('r1', 'a', 'b')
        const second = { ...relationship('r2', 'b', 'a'), count: 10 }
        const responseRows = [first, second]
        const sorted = sortRelationships(responseRows, 'count', 'descending', nodeIndex([node('a'), node('b')]))
        expect(sorted).toEqual([second, first])
        expect(responseRows).toEqual([first, second])
        expect(sorted[0]).toBe(second)
    })

    it('projects a 5k-node useful graph within the client preparation budget', () => {
        const nodes = Array.from({ length: 5000 }, (_, index) => node(`n${index}`))
        const relationships = Array.from({ length: 8000 }, (_, index) =>
            relationship(`r${index}`, `n${index % 5000}`, `n${(index + 1) % 5000}`)
        )
        const started = performance.now()
        const projection = buildGraphProjection(nodes, relationships)
        const elapsed = performance.now() - started
        expect(projection.nodes).toHaveLength(5000)
        expect(projection.links).toHaveLength(8000)
        expect(elapsed).toBeLessThan(1000)
    })

    it('ranks dense overview links deterministically without removing canonical relationships', () => {
        const nodes = [node('a'), node('b'), node('c'), node('d')]
        const strongest = { ...relationship('strongest', 'a', 'b'), count: 50 }
        const connected = { ...relationship('connected', 'b', 'c'), count: 8 }
        const weak = { ...relationship('weak', 'c', 'd'), count: 1 }

        const ranking = rankDenseGraphOverview(nodes, [weak, connected, strongest], 2)

        expect(ranking.relationshipIds).toEqual(['strongest', 'connected', 'weak'])
        expect(ranking.labelNodeIds).toEqual(['b', 'a'])
        expect(new Set(ranking.relationshipIds)).toEqual(new Set(['strongest', 'connected', 'weak']))
    })

    it('returns only movement states present in canonical relationships', () => {
        expect(
            movementStatesPresent([
                relationship('settled', 'a', 'b'),
                { ...relationship('pending', 'b', 'c'), state: 'PENDING' },
            ])
        ).toEqual(['SETTLED', 'PENDING'])
    })

    it('derives truncated coverage from settled events and handles a zero denominator', () => {
        const sampling = {
            strategy: 'TOP_N' as const,
            fullGraphEligible: false,
            reason: 'cap',
            truncated: true,
            requestedLimit: 5000,
            effectiveLimit: 5000,
            totalNodes: 5000,
            returnedNodes: 1000,
            totalRelationships: 8000,
            returnedRelationships: 2000,
            matchedSettledEventCount: 400,
            returnedSettledEventCount: 100,
        }
        expect(settledEventCoveragePercent(sampling)).toBe(25)
        expect(
            settledEventCoveragePercent({
                ...sampling,
                matchedSettledEventCount: 0,
                returnedSettledEventCount: 0,
            })
        ).toBe(0)
    })

    it('sums missing-principal movement counts rather than group count', () => {
        expect(missingPrincipalMovementCount([{ count: 7 }, { count: 3 }])).toBe(10)
    })
})
