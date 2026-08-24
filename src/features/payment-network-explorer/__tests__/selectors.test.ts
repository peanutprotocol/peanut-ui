import {
    buildGraphProjection,
    edgeTypeFacets,
    edgeTypesPresent,
    nodeIndex,
    rankDenseGraphOverview,
    reciprocityIndex,
    sortRelationships,
} from '../selectors'
import type { ExplorerNode, ExplorerRelationship } from '../types'

function node(id: string, username = id): ExplorerNode {
    return {
        id,
        username,
        hasAppAccess: true,
        directPoints: 0,
        transitivePoints: 0,
        totalPoints: 10,
        createdAt: null,
        lastActiveAt: null,
        kycRegions: null,
    }
}

function relationship(id: string, source: string, target: string): ExplorerRelationship {
    return {
        id,
        source,
        target,
        type: 'SEND_LINK',
        count: 2,
        totalUsd: 15,
        bidirectional: false,
    }
}

describe('canonical graph projection', () => {
    it('keeps one visual link per relationship and the exact canonical object', () => {
        const nodes = [node('a'), node('b')]
        const canonical = relationship('r1', 'a', 'b')
        const projection = buildGraphProjection(nodes, [canonical])
        expect(projection.links).toHaveLength(1)
        expect(projection.links[0].canonical).toBe(canonical)
        expect(projection.links[0].canonicalRelationshipId).toBe('r1')
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

    it('sorts by total USD and by endpoint username', () => {
        const cheap = { ...relationship('cheap', 'a', 'b'), totalUsd: 1 }
        const dear = { ...relationship('dear', 'b', 'a'), totalUsd: 900 }
        const nodes = nodeIndex([node('a', 'zoe'), node('b', 'amy')])
        expect(sortRelationships([cheap, dear], 'totalUsd', 'descending', nodes)[0]).toBe(dear)
        expect(sortRelationships([cheap, dear], 'source', 'ascending', nodes)[0]).toBe(dear)
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

    it('returns only edge types present in canonical relationships', () => {
        expect(
            edgeTypesPresent([
                relationship('send', 'a', 'b'),
                { ...relationship('transfer', 'b', 'c'), type: 'DIRECT_TRANSFER' },
            ])
        ).toEqual(['SEND_LINK', 'DIRECT_TRANSFER'])
    })

    it('computes client-side facet counts over the unfiltered response', () => {
        const facets = edgeTypeFacets([
            relationship('s1', 'a', 'b'),
            relationship('s2', 'b', 'c'),
            { ...relationship('t1', 'c', 'a'), type: 'DIRECT_TRANSFER' },
        ])
        expect(facets).toEqual([
            expect.objectContaining({ value: 'SEND_LINK', label: 'Send link', observedCount: 2 }),
            expect.objectContaining({ value: 'REQUEST_PAYMENT', observedCount: 0 }),
            expect.objectContaining({ value: 'DIRECT_TRANSFER', observedCount: 1 }),
        ])
    })
})

describe('reciprocity derived from the unfiltered response', () => {
    it('separates same-type reciprocity from the endpoint pair-level flag', () => {
        const sendOut = { ...relationship('a:b:SEND_LINK', 'a', 'b'), bidirectional: true }
        const sendBack = { ...relationship('b:a:SEND_LINK', 'b', 'a'), bidirectional: true }
        const transferBack = {
            ...relationship('b:a:DIRECT_TRANSFER', 'b', 'a'),
            type: 'DIRECT_TRANSFER' as const,
            bidirectional: true,
        }
        const lone = relationship('c:d:SEND_LINK', 'c', 'd')

        const index = reciprocityIndex([sendOut, sendBack, transferBack, lone])
        expect(index.get('a:b:SEND_LINK')).toBe('sameType')
        expect(index.get('b:a:SEND_LINK')).toBe('sameType')
        expect(index.get('b:a:DIRECT_TRANSFER')).toBe('otherType')
        expect(index.get('c:d:SEND_LINK')).toBe('oneWay')
    })

    it('reports oneWay when the only reverse row was filtered out of the input', () => {
        const sendOut = { ...relationship('a:b:SEND_LINK', 'a', 'b'), bidirectional: true }
        expect(reciprocityIndex([sendOut]).get('a:b:SEND_LINK')).toBe('oneWay')
    })
})
