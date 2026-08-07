import { fireEvent, render, screen } from '@testing-library/react'
import ExplorerSummary from '../ExplorerSummary'
import { PAYMENT_NETWORK_CONTRACT, type PaymentNetworkResponse } from '../types'

const data: PaymentNetworkResponse = {
    contractVersion: PAYMENT_NETWORK_CONTRACT,
    meta: {
        from: '2026-07-07T00:00:00.000Z',
        to: '2026-08-06T00:00:00.000Z',
        generatedAt: '2026-08-06T00:00:00.000Z',
        filters: {},
        sampling: {
            strategy: 'TOP_N',
            fullGraphEligible: false,
            reason: 'Benchmark gate closed.',
            truncated: true,
            requestedLimit: 5000,
            effectiveLimit: 5000,
            totalNodes: 8000,
            returnedNodes: 2000,
            totalRelationships: 12000,
            returnedRelationships: 3000,
            matchedSettledEventCount: 400,
            returnedSettledEventCount: 100,
        },
        coverage: {
            health: 'DEGRADED',
            settledMovementCount: 100,
            overlayEventCount: 0,
            overlayPostedMovementCount: 0,
            unclassifiedEventCount: 4,
            missingPrincipal: [
                { provider: 'A', kind: 'X', method: 'BANK', rail: 'R1', count: 7 },
                { provider: 'B', kind: 'Y', method: 'BANK', rail: 'R2', count: 3 },
            ],
        },
        focus: null,
    },
    facets: { providers: [], methods: [], rails: [], kinds: [], assets: [], chains: [], states: [], directions: [] },
    nodes: [],
    relationships: [],
}

describe('ExplorerSummary', () => {
    it('shows settled-event sample coverage and exact health debt in tooltips', async () => {
        render(<ExplorerSummary data={data} />)
        expect(screen.getByText('25% shown')).toBeInTheDocument()

        const health = screen.getByRole('button', { name: 'About data health' })
        fireEvent.focus(health)
        expect(await screen.findByRole('tooltip')).toHaveTextContent('10 movements across 2 principal-gap groups')
        fireEvent.keyDown(health, { key: 'Escape' })

        const sampling = screen.getByRole('button', { name: 'About sampling' })
        fireEvent.focus(sampling)
        expect(await screen.findByRole('tooltip')).toHaveTextContent('100 of 400 matched settled events returned')
        expect(screen.getByRole('tooltip')).toHaveTextContent('2,000 of 8,000 nodes')
        expect(screen.getByRole('tooltip')).toHaveTextContent('3,000 of 12,000 relationships')
    })
})
