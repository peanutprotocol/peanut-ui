import { serverFetch } from '@/utils/api-fetch'
import { fetchPaymentNetwork, PaymentNetworkApiError } from '../api'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

function response(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(body),
    } as unknown as Response
}

const emptyGraph = {
    nodes: [],
    edges: [],
    p2pEdges: [],
    stats: { totalNodes: 0, totalEdges: 0, totalP2PEdges: 0, usersWithAccess: 0, orphans: 0 },
}

describe('payment explorer data layer', () => {
    beforeEach(() => {
        jest.mocked(serverFetch).mockReset()
    })

    it('reads full mode through the authed client with only the supported params', async () => {
        jest.mocked(serverFetch).mockResolvedValue(response(emptyGraph))
        const data = await fetchPaymentNetwork(5000)
        expect(data).toEqual(emptyGraph)
        expect(serverFetch).toHaveBeenCalledWith(
            '/invites/graph?mode=full&topNodes=5000&includeNewDays=30',
            expect.objectContaining({ method: 'GET', cache: 'no-store', timeoutMs: 30_000 })
        )
    })

    it('omits topNodes only for the explicit all-users choice', async () => {
        jest.mocked(serverFetch).mockResolvedValue(response(emptyGraph))
        await fetchPaymentNetwork(0)
        expect(serverFetch).toHaveBeenCalledWith('/invites/graph?mode=full&includeNewDays=30', expect.any(Object))
    })

    it('maps 403 to a clean team-access error (the endpoint never 401s)', async () => {
        jest.mocked(serverFetch).mockResolvedValue(response({ error: 'Forbidden' }, 403))
        await expect(fetchPaymentNetwork(5000)).rejects.toMatchObject({
            name: 'PaymentNetworkApiError',
            status: 403,
            message: 'Your signed-in account does not have access to this explorer.',
        })
    })

    it('maps a server failure to a retryable error', async () => {
        jest.mocked(serverFetch).mockResolvedValue(response({ error: 'Failed to fetch invites graph' }, 500))
        await expect(fetchPaymentNetwork(5000)).rejects.toMatchObject({ status: 500 })
    })

    it('maps the client timeout error shape to 408 with fewer-top-users guidance', async () => {
        // fetchWithSentry converts its internal timeout abort before rethrowing.
        const timeout = new Error('Peanut is taking too long to respond — check your connection and try again.')
        timeout.name = 'ConnectionTimeoutError'
        jest.mocked(serverFetch).mockRejectedValue(timeout)
        await expect(fetchPaymentNetwork(5000)).rejects.toMatchObject({
            status: 408,
            code: 'TIMEOUT',
            message: 'The graph request timed out. Try fewer top users.',
        })
    })

    it('maps a network failure to 503', async () => {
        jest.mocked(serverFetch).mockRejectedValue(new TypeError('fetch failed'))
        await expect(fetchPaymentNetwork(5000)).rejects.toMatchObject({ status: 503, code: 'NETWORK_ERROR' })
    })

    it('exposes a typed error class for callers', () => {
        const error = new PaymentNetworkApiError('nope', 403)
        expect(error).toBeInstanceOf(Error)
        expect(error.status).toBe(403)
    })
})
