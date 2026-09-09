/** @jest-environment jsdom */
/**
 * Pins the 404 semantics of the two /tokens proxies (TASK-21829):
 * - price: 404 → undefined (a missing price legitimately means "not found")
 * - wallet portfolio: 404 → THROW. The API answers a genuinely empty wallet
 *   with 200 { balances: [] } and reserves 404 for "portfolio unavailable"
 *   (Mobula down/quota). Mapping 404 to an empty list rendered a false
 *   "No tokens to recover" on the recover-funds page whenever the upstream
 *   was down.
 */
import { fetchTokenPrice, fetchWalletBalances } from '@/services/tokens-price'
import { apiFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))

const mockCaptureException = jest.fn()
jest.mock('@sentry/nextjs', () => ({ captureException: (...args: unknown[]) => mockCaptureException(...args) }))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

const response = (status: number, body: unknown = {}) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    }) as unknown as Response

describe('fetchWalletBalances', () => {
    beforeEach(() => jest.clearAllMocks())

    it('returns the portfolio on 200', async () => {
        const body = { balances: [{ symbol: 'USDC' }], totalBalance: 10 }
        mockApiFetch.mockResolvedValue(response(200, body))
        await expect(fetchWalletBalances('0xabc')).resolves.toEqual(body)
    })

    it('passes a genuinely empty wallet through as an empty list', async () => {
        const body = { balances: [], totalBalance: 0 }
        mockApiFetch.mockResolvedValue(response(200, body))
        await expect(fetchWalletBalances('0xabc')).resolves.toEqual(body)
    })

    it('throws on 404 — unavailable is not an empty wallet', async () => {
        mockApiFetch.mockResolvedValue(response(404, { error: 'Wallet portfolio not available' }))
        await expect(fetchWalletBalances('0xabc')).rejects.toThrow('404')
    })

    it('throws on 5xx', async () => {
        mockApiFetch.mockResolvedValue(response(502, { error: 'bad gateway' }))
        await expect(fetchWalletBalances('0xabc')).rejects.toThrow('502')
        // fetchWithSentry already reported the HTTP failure — no second capture.
        expect(mockCaptureException).not.toHaveBeenCalled()
    })

    it('throws AND captures on a malformed 200 — the failure fetchWithSentry never sees', async () => {
        mockApiFetch.mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => {
                throw new SyntaxError('bad json')
            },
            text: async () => 'bad json',
        } as unknown as Response)
        await expect(fetchWalletBalances('0xabc')).rejects.toThrow('malformed 200')
        expect(mockCaptureException).toHaveBeenCalledTimes(1)
    })

    it('throws AND captures on a 200 missing the balances array', async () => {
        mockApiFetch.mockResolvedValue(response(200, { totalBalance: 5 }))
        await expect(fetchWalletBalances('0xabc')).rejects.toThrow('malformed 200')
        expect(mockCaptureException).toHaveBeenCalledTimes(1)
    })
})

describe('fetchTokenPrice', () => {
    beforeEach(() => jest.clearAllMocks())

    it('maps 404 to undefined — a missing price means not found', async () => {
        mockApiFetch.mockResolvedValue(response(404, { error: 'Token price not available' }))
        await expect(fetchTokenPrice('0xabc', '42161')).resolves.toBeUndefined()
    })
})
