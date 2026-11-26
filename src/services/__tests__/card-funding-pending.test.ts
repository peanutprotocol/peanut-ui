/**
 * "I've sent the transfer" tells the API (peanut-api-ts#2314) so the landing push opens the card step.
 * The API ships first; a UI that reaches an API without the route must stay quiet (TASK-25169).
 */
import { cardApi } from '@/services/card'

const mockApiFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/auth-token', () => ({ authReady: async () => undefined, getAuthToken: () => 'jwt' }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))

// the jsdom environment has no Response: the service reads only ok and status
const answer = (status: number) => ({ ok: status >= 200 && status < 300, status })

beforeEach(() => mockApiFetch.mockReset())

describe('cardApi.markFundingPending', () => {
    it('posts with no body: the session names the user', async () => {
        mockApiFetch.mockResolvedValue(answer(200))
        await cardApi.markFundingPending()
        expect(mockApiFetch).toHaveBeenCalledWith('/card/funding-pending', { method: 'POST' })
    })

    it('stays quiet when the API does not have the route yet (404)', async () => {
        mockApiFetch.mockResolvedValue(answer(404))
        await expect(cardApi.markFundingPending()).resolves.toBeUndefined()
    })

    it('fails on any other error, so the caller reports it', async () => {
        mockApiFetch.mockResolvedValue(answer(500))
        await expect(cardApi.markFundingPending()).rejects.toThrow('500')
    })
})
