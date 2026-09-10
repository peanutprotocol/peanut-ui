import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { defaultExplorerFilters } from '../query'
import { useDesktopViewport } from '../useDesktopViewport'
import { useExplorerUrlState } from '../useExplorerUrlState'
import { usePaymentNetworkExplorer } from '../usePaymentNetworkExplorer'
import PaymentNetworkExplorer from '../PaymentNetworkExplorer'
import { suppressPaymentNetworkTelemetry } from '../privacy'
import type { ExplorerGraphResponse, ExplorerNode } from '../types'

let mockGraphProps: Record<string, unknown> | null = null
let mockInspectorProps: Record<string, unknown> | null = null

jest.mock('../useDesktopViewport', () => ({ useDesktopViewport: jest.fn() }))
jest.mock('../useExplorerUrlState', () => ({ useExplorerUrlState: jest.fn() }))
jest.mock('../usePaymentNetworkExplorer', () => ({ usePaymentNetworkExplorer: jest.fn() }))
jest.mock('../privacy', () => ({ suppressPaymentNetworkTelemetry: jest.fn() }))
jest.mock(
    '../NetworkCanvas',
    () =>
        function MockNetworkCanvas(props: Record<string, unknown>) {
            mockGraphProps = props
            return <div>graph-surface</div>
        }
)
jest.mock(
    '../Inspector',
    () =>
        function MockInspector(props: Record<string, unknown>) {
            mockInspectorProps = props
            return <div>inspector-surface</div>
        }
)

const nodes: ExplorerNode[] = [
    {
        id: 'n1',
        username: 'alice',
        hasAppAccess: true,
        directPoints: 0,
        transitivePoints: 0,
        totalPoints: 10,
        createdAt: null,
        lastActiveAt: null,
        kycRegions: null,
    },
    {
        id: 'n2',
        username: 'bob',
        hasAppAccess: false,
        directPoints: 0,
        transitivePoints: 0,
        totalPoints: 5,
        createdAt: null,
        lastActiveAt: null,
        kycRegions: null,
    },
]
const data: ExplorerGraphResponse = {
    nodes,
    edges: [],
    p2pEdges: [
        { source: 'n1', target: 'n2', type: 'SEND_LINK', count: 2, totalUsd: 20, bidirectional: false },
        { source: 'n2', target: 'n1', type: 'DIRECT_TRANSFER', count: 8, totalUsd: 900, bidirectional: false },
    ],
    stats: { totalNodes: 2, totalEdges: 0, totalP2PEdges: 2, usersWithAccess: 1, orphans: 0 },
}

function explorerState(overrides: Record<string, unknown> = {}) {
    return {
        data,
        status: 'ready',
        error: null,
        reload: jest.fn(),
        ...overrides,
    }
}

describe('PaymentNetworkExplorer surface boundary', () => {
    beforeEach(() => {
        mockGraphProps = null
        mockInspectorProps = null
        jest.clearAllMocks()
        jest.mocked(useDesktopViewport).mockReturnValue({ ready: true, isDesktop: true })
        jest.mocked(useExplorerUrlState).mockReturnValue({ filters: defaultExplorerFilters(), setFilters: jest.fn() })
        jest.mocked(usePaymentNetworkExplorer).mockReturnValue(
            explorerState() as ReturnType<typeof usePaymentNetworkExplorer>
        )
    })

    afterEach(() => {
        window.history.replaceState({}, '', '/')
    })

    it('suppresses telemetry before rendering and derives relationships from p2p edges', () => {
        render(<PaymentNetworkExplorer />)
        const root = screen.getByText('graph-surface').closest('main')
        expect(suppressPaymentNetworkTelemetry).toHaveBeenCalled()
        expect(root).toHaveClass('ph-no-capture')
        expect(root).toHaveAttribute('data-private', 'true')
        expect(root).toHaveAttribute('data-sentry-mask')
        expect(mockGraphProps?.nodes).toBe(data.nodes)
        const relationships = mockGraphProps?.relationships as Array<{ id: string }>
        expect(relationships.map((item) => item.id)).toEqual(['n1:n2:SEND_LINK', 'n2:n1:DIRECT_TRANSFER'])
    })

    it('does not create a live graph request on an unsupported viewport', () => {
        jest.mocked(useDesktopViewport).mockReturnValue({ ready: true, isDesktop: false })
        render(<PaymentNetworkExplorer />)
        expect(screen.getByText('Open on a desktop')).toBeInTheDocument()
        expect(usePaymentNetworkExplorer).toHaveBeenCalledWith(null)
        expect(mockGraphProps).toBeNull()
    })

    it('requests the graph with the URL topNodes once the legacy scrub ran', async () => {
        jest.mocked(useExplorerUrlState).mockReturnValue({
            filters: { ...defaultExplorerFilters(), topNodes: 500 },
            setFilters: jest.fn(),
        })
        render(<PaymentNetworkExplorer />)
        await waitFor(() => expect(usePaymentNetworkExplorer).toHaveBeenLastCalledWith({ topNodes: 500 }))
    })

    it('shows a clean team-access state on 403', () => {
        jest.mocked(usePaymentNetworkExplorer).mockReturnValue(
            explorerState({ data: null, status: 'forbidden' }) as ReturnType<typeof usePaymentNetworkExplorer>
        )
        render(<PaymentNetworkExplorer />)
        expect(screen.getByText('Team access required')).toBeInTheDocument()
        expect(mockGraphProps).toBeNull()
    })

    it('offers a retry on server failure', () => {
        const reload = jest.fn()
        jest.mocked(usePaymentNetworkExplorer).mockReturnValue(
            explorerState({ data: null, status: 'error', reload }) as ReturnType<typeof usePaymentNetworkExplorer>
        )
        render(<PaymentNetworkExplorer />)
        fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
        expect(reload).toHaveBeenCalled()
    })

    it('scrubs a legacy password from the URL but keeps the plain user deep-link', () => {
        window.history.replaceState({}, '', '/dev/payment-graph?user=alice&password=marker-secret&top=500')
        render(<PaymentNetworkExplorer />)
        expect(window.location.search).toBe('?user=alice&top=500')
        expect(document.body.textContent).not.toContain('marker-secret')
    })

    it('resolves the ?user focus client-side and selects the focused node', async () => {
        jest.mocked(useExplorerUrlState).mockReturnValue({
            filters: { ...defaultExplorerFilters(), focus: 'alice' },
            setFilters: jest.fn(),
        })
        render(<PaymentNetworkExplorer />)
        expect(screen.getByText('Focused: alice')).toBeInTheDocument()
        expect(mockGraphProps?.focusNodeId).toBe('n1')
        await waitFor(() =>
            expect((mockInspectorProps?.selection as { node?: ExplorerNode } | null)?.node?.id).toBe('n1')
        )
    })

    it('marks a focus username that is not in the loaded graph', () => {
        jest.mocked(useExplorerUrlState).mockReturnValue({
            filters: { ...defaultExplorerFilters(), focus: 'carol' },
            setFilters: jest.fn(),
        })
        render(<PaymentNetworkExplorer />)
        expect(screen.getByText('Focused: carol')).toBeInTheDocument()
        expect(screen.getByText('not in loaded graph')).toBeInTheDocument()
        expect(mockGraphProps?.focusNodeId).toBeNull()
    })

    it('rejects a search for a user missing from the loaded graph and preserves the query', async () => {
        render(<PaymentNetworkExplorer />)
        const input = screen.getByRole('textbox', { name: 'Search by Peanut username' })
        fireEvent.change(input, { target: { value: 'alicia' } })
        fireEvent.click(screen.getByRole('button', { name: 'Find' }))
        await screen.findByRole('alert')
        expect(input).toHaveValue('alicia')
    })

    it('routes a known-user search into the plain focus URL state', async () => {
        const setFilters = jest.fn().mockResolvedValue(undefined)
        jest.mocked(useExplorerUrlState).mockReturnValue({ filters: defaultExplorerFilters(), setFilters })
        render(<PaymentNetworkExplorer />)
        const input = screen.getByRole('textbox', { name: 'Search by Peanut username' })
        fireEvent.change(input, { target: { value: 'alice' } })
        fireEvent.click(screen.getByRole('button', { name: 'Find' }))
        await waitFor(() => expect(setFilters).toHaveBeenCalledWith({ focus: 'alice' }))
    })

    it('wires the client-side filters into URL state', () => {
        const setFilters = jest.fn().mockResolvedValue(undefined)
        jest.mocked(useExplorerUrlState).mockReturnValue({ filters: defaultExplorerFilters(), setFilters })
        render(<PaymentNetworkExplorer />)
        fireEvent.change(screen.getByLabelText('Min transactions'), { target: { value: '4' } })
        expect(setFilters).toHaveBeenCalledWith({ minCount: 4 })
        fireEvent.change(screen.getByLabelText('Top users'), { target: { value: '1000' } })
        expect(setFilters).toHaveBeenCalledWith({ topNodes: 1000 })
    })

    it('applies client-side filters to the rendered relationships', () => {
        jest.mocked(useExplorerUrlState).mockReturnValue({
            filters: { ...defaultExplorerFilters(), minUsd: 100 },
            setFilters: jest.fn(),
        })
        render(<PaymentNetworkExplorer />)
        const relationships = mockGraphProps?.relationships as Array<{ id: string }>
        expect(relationships.map((item) => item.id)).toEqual(['n2:n1:DIRECT_TRANSFER'])
    })
})
