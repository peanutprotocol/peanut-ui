/** @jest-environment jsdom */
/**
 * Pins the 404 semantics of the /tokens/price proxy (TASK-21829): a missing
 * price legitimately means "not found". Recover funds no longer reads a wallet
 * portfolio from the API; it reads balances on-chain (TASK-23850).
 */
import { fetchTokenPrice } from '@/services/tokens-price'
import { apiFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

const response = (status: number, body: unknown = {}) =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => JSON.stringify(body),
    }) as unknown as Response

describe('fetchTokenPrice', () => {
    beforeEach(() => jest.clearAllMocks())

    it('maps 404 to undefined — a missing price means not found', async () => {
        mockApiFetch.mockResolvedValue(response(404, { error: 'Token price not available' }))
        await expect(fetchTokenPrice('0xabc', '42161')).resolves.toBeUndefined()
    })
})
