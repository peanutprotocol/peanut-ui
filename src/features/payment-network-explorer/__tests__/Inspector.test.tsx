import { fireEvent, render, screen } from '@testing-library/react'
import Inspector from '../Inspector'
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

describe('Inspector', () => {
    const nodes = [node('a', 'alice'), node('b', 'bob')]

    it('shows the real username and profile facts for a selected node', () => {
        render(
            <Inspector
                selection={{ type: 'node', node: nodes[0] }}
                nodes={nodes}
                relationships={[relationship]}
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
                onSelectRelationship={jest.fn()}
                onClear={jest.fn()}
            />
        )
        expect(screen.getByText('From')).toBeInTheDocument()
        expect(screen.getByText('Send link')).toBeInTheDocument()
        expect(screen.getByText('Both ways')).toBeInTheDocument()
        expect(screen.getByText('Yes')).toBeInTheDocument()
    })
})
