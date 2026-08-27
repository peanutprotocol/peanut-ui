import { fireEvent, render, screen } from '@testing-library/react'
import ExplorerSummary from '../ExplorerSummary'
import type { ExplorerGraphResponse, ExplorerNode } from '../types'

function node(id: string): ExplorerNode {
    return {
        id,
        username: `user-${id}`,
        hasAppAccess: true,
        directPoints: 0,
        transitivePoints: 0,
        totalPoints: 0,
        createdAt: null,
        lastActiveAt: null,
        kycRegions: null,
    }
}

const data: ExplorerGraphResponse = {
    nodes: [node('a'), node('b')],
    edges: [],
    p2pEdges: [
        { source: 'a', target: 'b', type: 'SEND_LINK', count: 2, totalUsd: 10, bidirectional: false },
        { source: 'b', target: 'a', type: 'DIRECT_TRANSFER', count: 1, totalUsd: 4, bidirectional: false },
    ],
    // The deployed endpoint always sets totalNodes to the returned node count.
    stats: { totalNodes: 2, totalEdges: 5, totalP2PEdges: 2, usersWithAccess: 1500, orphans: 0 },
}

describe('ExplorerSummary', () => {
    it('shows response stats, the filtered edge count and the fixed window label', () => {
        render(<ExplorerSummary data={data} visibleRelationshipCount={1} topNodes={5000} />)
        const summary = screen.getByRole('region', { name: 'Data summary' })
        expect(summary).toHaveTextContent('2 users')
        expect(summary).toHaveTextContent('1 of 2 payment edges')
        expect(summary).toHaveTextContent('1.5K with app access')
        expect(summary).toHaveTextContent('Last 120 days of payment activity')
        // The direct-transfer arm of p2pEdges.sql has no status filter, so the summary
        // must not claim the window is completed-only.
        expect(summary).not.toHaveTextContent('completed payments only')
    })

    it('reports the top-users request without asserting the network is larger', async () => {
        // nodes.length === topNodes cannot distinguish an exactly-topNodes population from a
        // truncated one, and includeNewDays can push the count past topNodes without truncation.
        render(<ExplorerSummary data={data} visibleRelationshipCount={2} topNodes={2} />)
        const sampling = screen.getByRole('button', { name: 'About sampling' })
        fireEvent.focus(sampling)
        const tooltip = await screen.findByRole('tooltip')
        expect(tooltip).toHaveTextContent('top users by points')
        expect(tooltip).not.toHaveTextContent('the full network is larger')
    })

    it('does not flag sampling below the limit or for the explicit all-users choice', () => {
        render(<ExplorerSummary data={data} visibleRelationshipCount={2} topNodes={5000} />)
        expect(screen.queryByRole('button', { name: 'About sampling' })).not.toBeInTheDocument()

        render(<ExplorerSummary data={data} visibleRelationshipCount={2} topNodes={0} />)
        expect(screen.queryByRole('button', { name: 'About sampling' })).not.toBeInTheDocument()
    })
})
