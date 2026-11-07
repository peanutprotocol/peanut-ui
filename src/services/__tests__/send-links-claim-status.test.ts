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
            expect.stringMatching(
                /^\/send-links\/0x[0-9a-f]+\/status\?c=42161&v=v4\.3&i=7&proof=\d+\.0x[0-9a-f]{130}$/i
            ),
            {
                method: 'GET',
                cache: 'no-store',
                timeoutMs: CLAIM_STATUS_TIMEOUT_MS,
                silentTimeout: true,
            }
        )
    })

    test('falls back to the legacy endpoint when the status route is unavailable', async () => {
        mockServerFetch.mockResolvedValueOnce({ ok: false, status: 404 } as Response).mockResolvedValueOnce({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ status: 'SUCCESS' }),
        } as Response)

        await expect(sendLinksApi.getClaimStatus(LINK)).resolves.toMatchObject({ status: 'SUCCESS' })

        expect(mockServerFetch).toHaveBeenNthCalledWith(
            2,
            expect.stringMatching(/^\/send-links\/0x[0-9a-f]+\?c=42161&v=v4\.3&i=7&proof=\d+\.0x[0-9a-f]{130}$/i),
            {
                method: 'GET',
                cache: 'no-store',
            }
        )
    })

    test('does not hide non-rollout errors behind the legacy endpoint', async () => {
        mockServerFetch.mockResolvedValue({ ok: false, status: 500 } as Response)

        await expect(sendLinksApi.getClaimStatus(LINK)).rejects.toThrow('HTTP error! status: 500')
        expect(mockServerFetch).toHaveBeenCalledTimes(1)
    })
})

describe('sendLinksApi.get', () => {
    beforeEach(() => mockServerFetch.mockReset())

    test('sends a link-key proof and never the password', async () => {
        mockServerFetch.mockResolvedValue({ ok: true, text: async () => '{}' } as Response)

        await sendLinksApi.get(LINK)

        const path = mockServerFetch.mock.calls[0][0]
        expect(path).toMatch(/^\/send-links\/0x[0-9a-f]{40}\?c=42161&v=v4\.3&i=7&proof=\d+\.0x[0-9a-f]{130}$/i)
        expect(path).not.toContain('secret')
    })
})
