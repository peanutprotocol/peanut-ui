/** @jest-environment jsdom */
import { sendLinksApi, CLAIM_STATUS_TIMEOUT_MS } from '@/services/sendLinks'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn(), serverFetch: jest.fn() }))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>
const LINK = 'https://peanut.to/claim?c=42161&v=v4.3&i=7#p=secret'

describe('sendLinksApi.getClaimStatus', () => {
    beforeEach(() => mockServerFetch.mockReset())

    test('uses the uncached status endpoint with a bounded transport budget', async () => {
        mockServerFetch.mockResolvedValue({
            ok: true,
            text: async () => JSON.stringify({ status: 'CLAIMING' }),
        } as Response)

        await sendLinksApi.getClaimStatus(LINK)

        expect(mockServerFetch).toHaveBeenCalledWith(
            expect.stringMatching(/^\/send-links\/0x[0-9a-f]+\/status\?c=42161&v=v4\.3&i=7$/i),
            {
                method: 'GET',
                cache: 'no-store',
                timeoutMs: CLAIM_STATUS_TIMEOUT_MS,
                silentTimeout: true,
            }
        )
    })
})
