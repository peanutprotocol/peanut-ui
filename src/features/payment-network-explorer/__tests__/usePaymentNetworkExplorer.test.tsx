import { act, renderHook, waitFor } from '@testing-library/react'
import {
    createExplorerFocus,
    createExplorerSession,
    fetchPaymentNetwork,
    PaymentNetworkApiError,
    revealExplorerNode,
} from '../api'
import { usePaymentNetworkExplorer } from '../usePaymentNetworkExplorer'
import { PAYMENT_NETWORK_CONTRACT, type ExplorerRequest, type PaymentNetworkResponse } from '../types'

jest.mock('../api', () => {
    const actual = jest.requireActual('../api')
    return {
        ...actual,
        createExplorerSession: jest.fn(),
        fetchPaymentNetwork: jest.fn(),
        createExplorerFocus: jest.fn(),
        revealExplorerNode: jest.fn(),
    }
})

const session = () => ({
    contractVersion: PAYMENT_NETWORK_CONTRACT,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    canReveal: true,
})
const request: ExplorerRequest = {
    from: '2026-07-07T12:00:00.000Z',
    to: '2026-08-06T12:00:00.000Z',
    providers: [],
    methods: [],
    rails: [],
    kinds: [],
    assets: [],
    chains: [],
    states: ['SETTLED'],
    directions: [],
    includeHubs: false,
    limit: 5000,
    focus: null,
}
const data = {
    contractVersion: PAYMENT_NETWORK_CONTRACT,
    meta: {
        from: request.from,
        to: request.to,
        generatedAt: request.to,
        filters: {},
        sampling: {
            strategy: 'TOP_N',
            fullGraphEligible: false,
            reason: 'hard-cap',
            truncated: false,
            requestedLimit: 5000,
            effectiveLimit: 5000,
            totalNodes: 0,
            returnedNodes: 0,
            totalRelationships: 0,
            returnedRelationships: 0,
            matchedSettledEventCount: 0,
            returnedSettledEventCount: 0,
        },
        coverage: {
            health: 'HEALTHY',
            settledMovementCount: 0,
            overlayEventCount: 0,
            overlayPostedMovementCount: 0,
            unclassifiedEventCount: 0,
            missingPrincipal: [],
        },
        focus: null,
    },
    facets: { providers: [], methods: [], rails: [], kinds: [], assets: [], chains: [], states: [], directions: [] },
    nodes: [],
    relationships: [],
} satisfies PaymentNetworkResponse

describe('usePaymentNetworkExplorer', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.mocked(createExplorerSession).mockResolvedValue(session())
        jest.mocked(fetchPaymentNetwork).mockResolvedValue(data)
    })

    it('does not create a sensitive session before a desktop request exists', () => {
        const { result } = renderHook(() => usePaymentNetworkExplorer(null))
        expect(result.current.status).toBe('idle')
        expect(createExplorerSession).not.toHaveBeenCalled()
        expect(fetchPaymentNetwork).not.toHaveBeenCalled()
    })

    it('creates the short-lived session before reading live graph data', async () => {
        const { result } = renderHook(() => usePaymentNetworkExplorer(request))
        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(result.current.data).toBe(data)
        expect(createExplorerSession).toHaveBeenCalledTimes(1)
        expect(createExplorerSession).toHaveBeenCalledWith()
        expect(fetchPaymentNetwork).toHaveBeenCalledWith(request, expect.any(AbortSignal))
        expect(jest.mocked(createExplorerSession).mock.invocationCallOrder[0]).toBeLessThan(
            jest.mocked(fetchPaymentNetwork).mock.invocationCallOrder[0]
        )
    })

    it('renews once and retries a graph read after a 401', async () => {
        jest.mocked(fetchPaymentNetwork)
            .mockRejectedValueOnce(new PaymentNetworkApiError('expired', 401))
            .mockResolvedValueOnce(data)
        const { result } = renderHook(() => usePaymentNetworkExplorer(request))
        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(createExplorerSession).toHaveBeenCalledTimes(2)
        expect(fetchPaymentNetwork).toHaveBeenCalledTimes(2)
    })

    it('fails closed and clears graph data when the team role is rejected', async () => {
        jest.mocked(createExplorerSession).mockRejectedValueOnce(new PaymentNetworkApiError('forbidden', 403))
        const { result } = renderHook(() => usePaymentNetworkExplorer(request))
        await waitFor(() => expect(result.current.status).toBe('forbidden'))
        expect(result.current.data).toBeNull()
        expect(result.current.session).toBeNull()
        expect(fetchPaymentNetwork).not.toHaveBeenCalled()
    })

    it('uses the same in-memory session for focus and reveal calls', async () => {
        jest.mocked(createExplorerFocus).mockResolvedValue({
            contractVersion: PAYMENT_NETWORK_CONTRACT,
            focusToken: 'opaque-focus-token-that-is-long-enough',
            expiresAt: 'later',
        })
        jest.mocked(revealExplorerNode).mockResolvedValue({
            contractVersion: PAYMENT_NETWORK_CONTRACT,
            nodeId: 'n1',
            label: 'alice',
            expiresAt: 'later',
        })
        const { result } = renderHook(() => usePaymentNetworkExplorer(null))
        await act(async () => {
            await result.current.focusUsername('alice')
            await result.current.revealNode('token', 'SUPPORT_CASE')
        })
        expect(createExplorerSession).toHaveBeenCalledTimes(1)
        expect(createExplorerFocus).toHaveBeenCalledWith('alice')
        expect(revealExplorerNode).toHaveBeenCalledWith('token', 'SUPPORT_CASE')
    })

    it('keeps a shared session request alive when the first load is superseded', async () => {
        let resolveSession!: (value: ReturnType<typeof session>) => void
        jest.mocked(createExplorerSession).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveSession = resolve
                })
        )
        const nextRequest = { ...request, providers: ['BRIDGE'] }
        const { result, rerender } = renderHook(
            ({ currentRequest }: { currentRequest: ExplorerRequest }) => usePaymentNetworkExplorer(currentRequest),
            { initialProps: { currentRequest: request } }
        )

        await waitFor(() => expect(createExplorerSession).toHaveBeenCalledTimes(1))
        rerender({ currentRequest: nextRequest })
        act(() => resolveSession(session()))

        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(createExplorerSession).toHaveBeenCalledTimes(1)
        expect(createExplorerSession).toHaveBeenCalledWith()
        expect(fetchPaymentNetwork).toHaveBeenCalledTimes(1)
        expect(fetchPaymentNetwork).toHaveBeenCalledWith(nextRequest, expect.any(AbortSignal))
    })

    it('retains a resolved shared session when every initiating load was superseded', async () => {
        let resolveSession!: (value: ReturnType<typeof session>) => void
        jest.mocked(createExplorerSession).mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveSession = resolve
                })
        )
        const nextRequest = { ...request, rails: ['ACH_US'] }
        const { result, rerender } = renderHook(
            ({ currentRequest }: { currentRequest: ExplorerRequest | null }) =>
                usePaymentNetworkExplorer(currentRequest),
            { initialProps: { currentRequest: request as ExplorerRequest | null } }
        )

        await waitFor(() => expect(createExplorerSession).toHaveBeenCalledTimes(1))
        rerender({ currentRequest: null })
        act(() => resolveSession(session()))
        await waitFor(() => expect(result.current.session).not.toBeNull())

        rerender({ currentRequest: nextRequest })
        await waitFor(() => expect(result.current.status).toBe('ready'))
        expect(createExplorerSession).toHaveBeenCalledTimes(1)
        expect(fetchPaymentNetwork).toHaveBeenCalledTimes(1)
        expect(fetchPaymentNetwork).toHaveBeenCalledWith(nextRequest, expect.any(AbortSignal))
    })
})
