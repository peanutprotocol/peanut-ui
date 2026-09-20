/**
 * requestsApi — the multi-currency request contract: what create sends, which
 * account deposit-instructions asks for, and how an API without the
 * pay-amounts route reads.
 */
import { requestsApi } from '@/services/requests'
import type { CreateRequestRequest } from '@/services/services.types'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/utils/general.utils', () => ({ jsonStringify: (value: unknown) => JSON.stringify(value) }))

const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>
const response = (status: number, body: unknown = {}): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        statusText: String(status),
        json: async () => body,
        text: async () => JSON.stringify(body),
    }) as Response

const base: CreateRequestRequest = {
    chainId: '42161',
    tokenAmount: '125.00',
    recipientAddress: '0xrecipient',
    tokenType: '1',
    tokenAddress: '0xusdc',
    tokenDecimals: '6',
    tokenSymbol: 'USDC',
}

beforeEach(() => jest.clearAllMocks())

describe('requestsApi.create', () => {
    it('sends the asked amount and currency beside the dollar tokenAmount', async () => {
        mockFetch.mockResolvedValue(response(200, { uuid: 'req-1' }))

        await requestsApi.create({ ...base, requestedAmount: { amount: '100', currency: 'EUR' } })

        const [path, init] = mockFetch.mock.calls[0]
        expect(path).toBe('/requests')
        expect(JSON.parse(init!.body as string)).toEqual({
            ...base,
            requestedAmount: { amount: '100', currency: 'EUR' },
        })
    })

    // The screen explains "no rate" and "bad amount" differently, so the
    // error must carry the API's code and status, not just its message.
    it('throws the API message, code and status when the API refuses the body', async () => {
        mockFetch.mockResolvedValue(response(503, { error: 'FX is down', code: 'FX_UNAVAILABLE' }))

        await expect(
            requestsApi.create({ ...base, requestedAmount: { amount: '100', currency: 'EUR' } })
        ).rejects.toMatchObject({ message: 'FX is down', code: 'FX_UNAVAILABLE', status: 503 })
    })
})

describe('requestsApi.depositInstructions', () => {
    it('asks for the account in the currency the payer chose', async () => {
        mockFetch.mockResolvedValue(response(200, { paymentReference: 'a1b2c3d4' }))

        await requestsApi.depositInstructions('req-1', 'EUR')

        expect(mockFetch).toHaveBeenCalledWith('/requests/req-1/deposit-instructions?currency=EUR', { method: 'GET' })
    })

    it('names no currency when the payer chose none', async () => {
        mockFetch.mockResolvedValue(response(200, {}))

        await requestsApi.depositInstructions('req-1')

        expect(mockFetch).toHaveBeenCalledWith('/requests/req-1/deposit-instructions', { method: 'GET' })
    })
})

describe('requestsApi.payAmounts', () => {
    it('returns the per-rail amounts', async () => {
        const body = { requestCurrency: 'EUR', requestAmount: '100.00', rails: [] }
        mockFetch.mockResolvedValue(response(200, body))

        await expect(requestsApi.payAmounts('req-1')).resolves.toEqual(body)
        expect(mockFetch).toHaveBeenCalledWith('/requests/req-1/pay-amounts', { method: 'GET' })
    })

    // An API that predates the route, or a request that is gone.
    it('reads a 404 as "no amounts", not as a failure', async () => {
        mockFetch.mockResolvedValue(response(404))

        await expect(requestsApi.payAmounts('req-1')).resolves.toBeNull()
    })

    it('throws on any other failure', async () => {
        mockFetch.mockResolvedValue(response(500))

        await expect(requestsApi.payAmounts('req-1')).rejects.toThrow('Failed to fetch pay amounts')
    })
})
