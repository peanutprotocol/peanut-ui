/**
 * The create call can spend most of a minute inside the API before the
 * provider is even asked: the first withdraw on a rail grants the endorsement
 * on the request path, and that grant polls. The client budget is 20s, so the
 * browser could abort while the API was still working — and if the abort
 * landed after the provider had created the transfer, a retry created a second
 * one. Confirm already buys the longer budget for the same reason.
 */
const mockServerFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ serverFetch: (...args: unknown[]) => mockServerFetch(...args) }))

import { createOfframp, confirmOfframp } from '../offramp'

beforeEach(() => {
    jest.clearAllMocks()
    mockServerFetch.mockResolvedValue({ ok: true, json: async () => ({ transferId: 't1' }) })
})

it('gives the create call a budget the endorsement grant fits inside', async () => {
    await createOfframp({ amount: '10' } as never)

    expect(mockServerFetch).toHaveBeenCalledWith(
        '/bridge/offramp/create',
        expect.objectContaining({ timeoutMs: 60_000 })
    )
})

it('keeps the same budget on confirm', async () => {
    await confirmOfframp('transfer-1', '0xhash')

    expect(mockServerFetch).toHaveBeenCalledWith(
        '/bridge/transfers/transfer-1/confirm',
        expect.objectContaining({ timeoutMs: 60_000 })
    )
})
