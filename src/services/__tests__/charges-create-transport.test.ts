/** @jest-environment jsdom */
/**
 * chargesApi.create must send JSON through apiFetch unless a real file rides
 * along. The multipart path bypasses apiFetch and therefore never gets the
 * native-transport cookie fallback — on a tokenless native session (legacy
 * cookie-jar auth) a FormData POST goes out with no auth at all and 4xxs
 * as "Contact support" (the reported broken send-to-username on Android).
 */
import { chargesApi } from '@/services/charges'
import { ApiError } from '@/services/api-error'
import { apiFetch } from '@/utils/api-fetch'
import { fetchWithSentry } from '@/utils/sentry.utils'
import type { CreateChargeRequest } from '@/services/services.types'

jest.mock('@/utils/api-fetch', () => ({
    apiFetch: jest.fn(),
    serverFetch: jest.fn(),
}))
jest.mock('@/utils/sentry.utils', () => ({
    fetchWithSentry: jest.fn(),
}))
jest.mock('@/utils/auth-token', () => ({
    authReady: jest.fn().mockResolvedValue(undefined),
    getAuthToken: jest.fn().mockReturnValue(null),
}))
jest.mock('@/utils/demo', () => ({
    isDemoMode: jest.fn().mockReturnValue(false),
}))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const mockFetchWithSentry = fetchWithSentry as jest.MockedFunction<typeof fetchWithSentry>

const chargeData: CreateChargeRequest = {
    pricing_type: 'fixed_price',
    local_price: { amount: '5', currency: 'USD' },
    baseUrl: 'https://peanut.me',
    requestProps: { chainId: '42161' } as CreateChargeRequest['requestProps'],
}

const okResponse = (body: unknown): Response =>
    ({ ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) }) as Response

beforeEach(() => {
    mockApiFetch.mockReset()
    mockFetchWithSentry.mockReset()
})

describe('chargesApi.create transport', () => {
    it('sends JSON via apiFetch when there is no file attachment', async () => {
        mockApiFetch.mockResolvedValue(okResponse({ data: { id: 'c1' } }))

        await chargesApi.create(chargeData)

        expect(mockFetchWithSentry).not.toHaveBeenCalled()
        expect(mockApiFetch).toHaveBeenCalledWith('/charges', {
            method: 'POST',
            body: JSON.stringify(chargeData),
        })
    })

    it('sends multipart via fetchWithSentry when a file attachment is present', async () => {
        mockFetchWithSentry.mockResolvedValue(okResponse({ data: { id: 'c2' } }))

        const withFile = { ...chargeData, attachment: new File(['x'], 'receipt.png', { type: 'image/png' }) }
        await chargesApi.create(withFile)

        expect(mockApiFetch).not.toHaveBeenCalled()
        expect(mockFetchWithSentry).toHaveBeenCalledTimes(1)
        const [, init] = mockFetchWithSentry.mock.calls[0]
        expect(init?.body).toBeInstanceOf(FormData)
    })

    it('throws ApiError carrying status and backend code on failure', async () => {
        mockApiFetch.mockResolvedValue({
            ok: false,
            status: 401,
            text: () => Promise.resolve(JSON.stringify({ message: 'authorization required', code: 'UNAUTHORIZED' })),
        } as Response)

        const err = await chargesApi.create(chargeData).catch((e) => e)
        expect(err).toBeInstanceOf(ApiError)
        expect(err.status).toBe(401)
        expect(err.code).toBe('UNAUTHORIZED')
        expect(err.message).toBe('authorization required')
    })

    it('falls back to a stable message when the error body is not JSON', async () => {
        mockApiFetch.mockResolvedValue({
            ok: false,
            status: 502,
            text: () => Promise.resolve('<html>bad gateway</html>'),
        } as Response)

        const err = await chargesApi.create(chargeData).catch((e) => e)
        expect(err).toBeInstanceOf(ApiError)
        expect(err.status).toBe(502)
        expect(err.message).toBe('Failed to create charge')
    })
})
