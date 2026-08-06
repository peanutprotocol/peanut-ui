import { withStepUpHeader } from '@/services/step-up'
import { authReady, getAuthHeaders } from '@/utils/auth-token'
import {
    createExplorerFocus,
    createExplorerSession,
    fetchPaymentNetwork,
    PaymentNetworkApiError,
    revealExplorerNode,
} from '../api'
import { PAYMENT_NETWORK_CONTRACT, PAYMENT_NETWORK_MEDIA_TYPE, type ExplorerRequest } from '../types'

jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.peanut.test' }))
jest.mock('@/utils/auth-token', () => ({
    authReady: jest.fn().mockResolvedValue(undefined),
    getAuthHeaders: jest.fn((headers: Record<string, string>) => ({ ...headers, Authorization: 'Bearer jwt' })),
}))
jest.mock('@/services/step-up', () => ({
    withStepUpHeader: jest.fn().mockResolvedValue({ 'x-step-up-token': 'proof' }),
}))

const mockedFetch = jest.fn()
const request: ExplorerRequest = {
    from: '2026-07-07T12:00:00.000Z',
    to: '2026-08-06T12:00:00.000Z',
    providers: [],
    methods: ['QR'],
    rails: ['PIX_BR'],
    kinds: [],
    assets: [],
    chains: [],
    states: ['SETTLED'],
    directions: [],
    includeHubs: false,
    limit: 5000,
    focus: null,
}

function response(body: unknown, status = 200, contract: string = PAYMENT_NETWORK_CONTRACT): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers({
            'X-Peanut-Graph-Contract': contract,
            'Content-Type': 'application/json; charset=utf-8',
        }),
        json: jest.fn().mockResolvedValue(body),
    } as unknown as Response
}

describe('payment explorer API isolation', () => {
    beforeAll(() => {
        Object.defineProperty(global, 'fetch', { configurable: true, writable: true, value: mockedFetch })
    })

    beforeEach(() => {
        mockedFetch.mockReset()
        jest.mocked(authReady).mockClear()
        jest.mocked(getAuthHeaders).mockClear()
        jest.mocked(withStepUpHeader).mockClear()
    })

    it('creates a no-store HttpOnly-backed explorer session with the v2 media type', async () => {
        mockedFetch.mockResolvedValue(
            response({ contractVersion: PAYMENT_NETWORK_CONTRACT, expiresAt: 'later', canReveal: false })
        )
        await createExplorerSession()
        expect(authReady).toHaveBeenCalled()
        expect(mockedFetch).toHaveBeenCalledWith(
            'https://api.peanut.test/invites/graph/session',
            expect.objectContaining({
                method: 'POST',
                body: '{}',
                cache: 'no-store',
                credentials: 'include',
                headers: expect.objectContaining({ Accept: 'application/json', Authorization: 'Bearer jwt' }),
            })
        )
        const headers = mockedFetch.mock.calls[0][1].headers
        expect(headers).not.toHaveProperty('X-Peanut-Graph-Contract')
    })

    it('requests only live v2 graph query fields and never sends a username', async () => {
        const graphResponse = response({
            contractVersion: PAYMENT_NETWORK_CONTRACT,
            meta: {},
            facets: {},
            nodes: [],
            relationships: [],
        })
        graphResponse.headers.set('Content-Type', `${PAYMENT_NETWORK_MEDIA_TYPE}; charset=utf-8`)
        mockedFetch.mockResolvedValue(graphResponse)
        await fetchPaymentNetwork(request)
        const url = String(mockedFetch.mock.calls[0][0])
        expect(url).toContain('/invites/graph?mode=payment')
        expect(url).toContain('methods=QR')
        expect(url).toContain('rails=PIX_BR')
        expect(url).not.toContain('user=')
        expect(url).not.toContain('username=')
        expect(url).not.toContain('password=')
        expect(mockedFetch.mock.calls[0][1].headers).toEqual(
            expect.objectContaining({ Accept: PAYMENT_NETWORK_MEDIA_TYPE })
        )
        expect(mockedFetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
        expect(authReady).not.toHaveBeenCalled()
        expect(getAuthHeaders).not.toHaveBeenCalled()
    })

    it('posts username only to focus and returns an opaque token', async () => {
        mockedFetch.mockResolvedValue(
            response({
                contractVersion: PAYMENT_NETWORK_CONTRACT,
                focusToken: 'opaque-focus-token-that-is-long-enough',
                expiresAt: 'later',
            })
        )
        await createExplorerFocus(' alice ')
        expect(mockedFetch.mock.calls[0][0]).toBe('https://api.peanut.test/invites/graph/focus')
        expect(JSON.parse(mockedFetch.mock.calls[0][1].body)).toEqual({ username: 'alice' })
        expect(mockedFetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
        expect(authReady).not.toHaveBeenCalled()
        expect(getAuthHeaders).not.toHaveBeenCalled()
    })

    it('requires step-up proof for audited reveals', async () => {
        mockedFetch.mockResolvedValue(
            response({ contractVersion: PAYMENT_NETWORK_CONTRACT, nodeId: 'n1', label: 'alice', expiresAt: 'later' })
        )
        await revealExplorerNode('reveal-token', 'FRAUD_REVIEW')
        expect(withStepUpHeader).toHaveBeenCalledWith({})
        expect(mockedFetch.mock.calls[0][1].headers).toEqual(expect.objectContaining({ 'x-step-up-token': 'proof' }))
        expect(mockedFetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
        expect(authReady).not.toHaveBeenCalled()
        expect(getAuthHeaders).not.toHaveBeenCalled()
    })

    it('fails closed on a contract header mismatch without exposing the response body', async () => {
        mockedFetch.mockResolvedValue(response({ contractVersion: PAYMENT_NETWORK_CONTRACT }, 200, 'legacy'))
        await expect(createExplorerSession()).rejects.toEqual(
            expect.objectContaining<Partial<PaymentNetworkApiError>>({ status: 409, code: 'CONTRACT_HEADER_MISMATCH' })
        )
    })

    it('maps server errors to bounded messages and keeps only the safe code', async () => {
        mockedFetch.mockResolvedValue(response({ error: 'secret provider detail', code: 'NO_ROLE' }, 403))
        await expect(createExplorerSession()).rejects.toEqual(
            expect.objectContaining<Partial<PaymentNetworkApiError>>({
                status: 403,
                code: 'NO_ROLE',
                message: 'Your account does not have access to this explorer.',
            })
        )
    })
})
