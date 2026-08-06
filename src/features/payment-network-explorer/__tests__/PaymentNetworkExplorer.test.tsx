import { act, render, screen, waitFor } from '@testing-library/react'
import { defaultExplorerFilters } from '../query'
import { useDesktopViewport } from '../useDesktopViewport'
import { useExplorerUrlState } from '../useExplorerUrlState'
import { usePaymentNetworkExplorer } from '../usePaymentNetworkExplorer'
import PaymentNetworkExplorer from '../PaymentNetworkExplorer'
import { suppressPaymentNetworkTelemetry } from '../privacy'
import {
    PAYMENT_NETWORK_CONTRACT,
    type ExplorerNode,
    type ExplorerRelationship,
    type PaymentNetworkResponse,
} from '../types'

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

const relationship: ExplorerRelationship = {
    id: 'r1',
    source: 'n1',
    target: 'n2',
    provider: 'PEANUT',
    method: 'P2P',
    rail: 'PEANUT_DIRECT',
    kind: 'TRANSFER',
    direction: 'OUTGOING',
    state: 'SETTLED',
    evidence: 'POSTED_PRINCIPAL',
    timeBasis: 'COMPLETED_AT',
    asset: null,
    count: 1,
    settledPaymentCount: 1,
    nativeAmount: null,
    overlayNativeAmount: null,
    firstAt: '2026-08-01T00:00:00.000Z',
    lastAt: '2026-08-01T00:00:00.000Z',
    bidirectional: false,
}
const nodes: ExplorerNode[] = [
    {
        id: 'n1',
        type: 'USER',
        label: 'alice',
        labelVisibility: 'VISIBLE',
        paymentCount: 1,
        overlayCount: 0,
        assets: [],
    },
    { id: 'n2', type: 'USER', label: 'bob', labelVisibility: 'VISIBLE', paymentCount: 1, overlayCount: 0, assets: [] },
]
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
            reason: 'hard-cap',
            truncated: false,
            requestedLimit: 5000,
            effectiveLimit: 5000,
            totalNodes: 2,
            returnedNodes: 2,
            totalRelationships: 1,
            returnedRelationships: 1,
            matchedSettledEventCount: 1,
            returnedSettledEventCount: 1,
        },
        coverage: {
            health: 'HEALTHY',
            settledMovementCount: 1,
            overlayEventCount: 0,
            overlayPostedMovementCount: 0,
            unclassifiedEventCount: 0,
            missingPrincipal: [],
        },
        focus: null,
    },
    facets: { providers: [], methods: [], rails: [], kinds: [], assets: [], chains: [], states: [], directions: [] },
    nodes: [...nodes],
    relationships: [relationship],
}

function explorerState(overrides: Record<string, unknown> = {}) {
    return {
        data,
        session: { contractVersion: PAYMENT_NETWORK_CONTRACT, expiresAt: 'later', canReveal: false },
        status: 'ready',
        error: null,
        searching: false,
        revealing: false,
        reload: jest.fn(),
        focusUsername: jest.fn(),
        revealNode: jest.fn(),
        ...overrides,
    }
}

describe('PaymentNetworkExplorer surface boundary', () => {
    beforeEach(() => {
        mockGraphProps = null
        mockInspectorProps = null
        jest.clearAllMocks()
        jest.mocked(useExplorerUrlState).mockReturnValue({ filters: defaultExplorerFilters(), setFilters: jest.fn() })
        jest.mocked(usePaymentNetworkExplorer).mockReturnValue(
            explorerState() as ReturnType<typeof usePaymentNetworkExplorer>
        )
    })

    afterEach(() => {
        window.history.replaceState({}, '', '/')
    })

    it('suppresses telemetry before rendering and passes canonical response arrays through unchanged', () => {
        jest.mocked(useDesktopViewport).mockReturnValue({ ready: true, isDesktop: true })
        render(<PaymentNetworkExplorer />)
        const root = screen.getByText('graph-surface').closest('main')
        expect(suppressPaymentNetworkTelemetry).toHaveBeenCalled()
        expect(root).toHaveClass('ph-no-capture')
        expect(root).toHaveAttribute('data-private', 'true')
        expect(root).toHaveAttribute('data-sentry-mask')
        expect(mockGraphProps?.nodes).toBe(data.nodes)
        expect(mockGraphProps?.relationships).toBe(data.relationships)
        expect(mockInspectorProps?.nodes).toBe(data.nodes)
        expect(mockInspectorProps?.relationships).toBe(data.relationships)
    })

    it('does not create a live graph request on an unsupported viewport', () => {
        jest.mocked(useDesktopViewport).mockReturnValue({ ready: true, isDesktop: false })
        render(<PaymentNetworkExplorer />)
        expect(screen.getByText('Open on a desktop')).toBeInTheDocument()
        expect(usePaymentNetworkExplorer).toHaveBeenCalledWith(null)
        expect(mockGraphProps).toBeNull()
    })

    it('scrubs legacy credentials before any graph read and exchanges username only through focus', async () => {
        window.history.replaceState({}, '', '/dev/payment-graph?user=marker-alice&password=marker-secret&range=7d')
        window.localStorage.setItem('marker-existing', 'keep')
        const focusUsername = jest.fn().mockResolvedValue({
            contractVersion: PAYMENT_NETWORK_CONTRACT,
            focusToken: 'opaque-focus-token-that-is-long-enough',
            expiresAt: 'later',
        })
        const setFilters = jest.fn().mockResolvedValue(undefined)
        const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => undefined)
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
        jest.mocked(useDesktopViewport).mockReturnValue({ ready: true, isDesktop: true })
        jest.mocked(useExplorerUrlState).mockReturnValue({ filters: defaultExplorerFilters(), setFilters })
        jest.mocked(usePaymentNetworkExplorer).mockReturnValue(
            explorerState({ data: null, status: 'idle', focusUsername }) as ReturnType<typeof usePaymentNetworkExplorer>
        )

        render(<PaymentNetworkExplorer />)

        expect(window.location.search).toBe('?range=7d')
        expect(usePaymentNetworkExplorer).toHaveBeenCalledWith(null)
        expect(document.body.textContent).not.toContain('marker-alice')
        expect(document.body.textContent).not.toContain('marker-secret')
        await waitFor(() => expect(focusUsername).toHaveBeenCalledWith('marker-alice'))
        await waitFor(() =>
            expect(setFilters).toHaveBeenCalledWith({ focus: 'opaque-focus-token-that-is-long-enough' })
        )
        expect(window.localStorage.getItem('marker-existing')).toBe('keep')
        expect(consoleLog).not.toHaveBeenCalled()
        expect(consoleWarn).not.toHaveBeenCalled()
        expect(consoleError).not.toHaveBeenCalled()
        consoleLog.mockRestore()
        consoleWarn.mockRestore()
        consoleError.mockRestore()
    })

    it('clears privileged reveals on background resume and pagehide', async () => {
        const now = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-06T12:00:00.000Z').getTime())
        const revealNode = jest.fn().mockResolvedValue({
            contractVersion: PAYMENT_NETWORK_CONTRACT,
            nodeId: 'n1',
            label: 'privileged-alice',
            expiresAt: '2026-08-06T12:01:00.000Z',
        })
        jest.mocked(useDesktopViewport).mockReturnValue({ ready: true, isDesktop: true })
        jest.mocked(usePaymentNetworkExplorer).mockReturnValue(
            explorerState({
                session: { contractVersion: PAYMENT_NETWORK_CONTRACT, expiresAt: 'later', canReveal: true },
                revealNode,
            }) as ReturnType<typeof usePaymentNetworkExplorer>
        )
        const { unmount } = render(<PaymentNetworkExplorer />)
        const revealableNode = { ...nodes[0], revealToken: 'opaque-reveal-token' }
        act(() => {
            ;(mockGraphProps?.onSelectNode as (node: ExplorerNode) => void)(revealableNode)
        })
        await act(async () => {
            await (mockInspectorProps?.onReveal as (node: ExplorerNode, reason: string) => Promise<void>)(
                revealableNode,
                'INVESTIGATION'
            )
        })
        await waitFor(() =>
            expect((mockInspectorProps?.revealed as { label: string } | null)?.label).toBe('privileged-alice')
        )

        now.mockReturnValue(new Date('2026-08-06T12:01:01.000Z').getTime())
        act(() => document.dispatchEvent(new Event('visibilitychange')))
        expect(mockInspectorProps?.revealed).toBeNull()

        now.mockReturnValue(new Date('2026-08-06T12:00:10.000Z').getTime())
        await act(async () => {
            await (mockInspectorProps?.onReveal as (node: ExplorerNode, reason: string) => Promise<void>)(
                revealableNode,
                'INVESTIGATION'
            )
        })
        expect(mockInspectorProps?.revealed).not.toBeNull()
        act(() => window.dispatchEvent(new Event('pagehide')))
        expect(mockInspectorProps?.revealed).toBeNull()

        unmount()
        now.mockRestore()
    })
})
