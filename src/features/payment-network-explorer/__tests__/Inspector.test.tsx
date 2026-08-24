import { fireEvent, render, screen } from '@testing-library/react'
import Inspector from '../Inspector'
import { reciprocityIndex } from '../selectors'
import type { ExplorerNode, ExplorerRelationship } from '../types'

const node = (id: string, username: string): ExplorerNode => ({
    id,
    username,
    hasAppAccess: true,
    directPoints: 5,
    transitivePoints: 5,
    totalPoints: 10,
    createdAt: '2026-06-01T00:00:00.000Z',
    lastActiveAt: null,
    kycRegions: ['AR'],
})

const relationship: ExplorerRelationship = {
    id: 'a:b:SEND_LINK',
    source: 'a',
    target: 'b',
    type: 'SEND_LINK',
    count: 3,
    totalUsd: 42,
    bidirectional: true,
}

// The endpoint flags this SEND_LINK as bidirectional because a DIRECT_TRANSFER
// came back — the reverse of this row's own type does not exist.
const reverseOfAnotherType: ExplorerRelationship = {
    id: 'b:a:DIRECT_TRANSFER',
    source: 'b',
    target: 'a',
    type: 'DIRECT_TRANSFER',
    count: 1,
    totalUsd: 7,
    bidirectional: true,
}

describe('Inspector', () => {
    const nodes = [node('a', 'alice'), node('b', 'bob')]
    const reciprocity = reciprocityIndex([relationship, reverseOfAnotherType])

    it('shows the real username and profile facts for a selected node', () => {
        render(
            <Inspector
                selection={{ type: 'node', node: nodes[0] }}
                nodes={nodes}
                relationships={[relationship]}
                reciprocity={reciprocity}
                onSelectRelationship={jest.fn()}
                onClear={jest.fn()}
            />
        )
        expect(screen.getByText('alice')).toBeInTheDocument()
        expect(screen.getByText(/App access/)).toBeInTheDocument()
        expect(screen.getByText(/KYC AR/)).toBeInTheDocument()
        expect(screen.getByText('Total points')).toBeInTheDocument()
    })

    it('lists connections with count and USD, and selects one on click', () => {
        const onSelectRelationship = jest.fn()
        render(
            <Inspector
                selection={{ type: 'node', node: nodes[0] }}
                nodes={nodes}
                relationships={[relationship]}
                reciprocity={reciprocity}
                onSelectRelationship={onSelectRelationship}
                onClear={jest.fn()}
            />
        )
        const connection = screen.getByRole('button', { name: /bob/ })
        expect(connection).toHaveTextContent('$42.00')
        fireEvent.click(connection)
        expect(onSelectRelationship).toHaveBeenCalledWith(relationship)
    })

    it('shows honest directed relationship details', () => {
        render(
            <Inspector
                selection={{ type: 'relationship', relationship }}
                nodes={nodes}
                relationships={[relationship]}
                reciprocity={reciprocity}
                onSelectRelationship={jest.fn()}
                onClear={jest.fn()}
            />
        )
        expect(screen.getByText('From')).toBeInTheDocument()
        expect(screen.getByText('Send link')).toBeInTheDocument()
        // The endpoint's pair-level flag says bidirectional; this row's own type is not.
        expect(screen.getByText('Direction')).toBeInTheDocument()
        expect(screen.getByText('Reverse payment of another type')).toBeInTheDocument()
    })
})
