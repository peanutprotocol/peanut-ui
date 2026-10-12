/**
 * USD payout speeds (TASK-23054): the fee table and the account's rails, read
 * from the backend. The app shows these and never a fee of its own.
 */
const mockServerFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ serverFetch: (...args: unknown[]) => mockServerFetch(...args) }))

import { getExternalAccountPaymentRails, getUsdPayoutRailFees } from '../offramp'

const FEES = {
    currency: 'USD',
    minimumAfterFeeUsd: '1.00',
    rails: [
        { rail: 'ach_same_day', feeUsd: '0.00' },
        { rail: 'wire', feeUsd: '20.00' },
    ],
}

beforeEach(() => jest.clearAllMocks())

describe('getUsdPayoutRailFees', () => {
    it('returns the fee table', async () => {
        mockServerFetch.mockResolvedValue({ ok: true, json: async () => FEES })
        const { data, error } = await getUsdPayoutRailFees()
        expect(mockServerFetch).toHaveBeenCalledWith('/bridge/offramp/rail-fees', { method: 'GET' })
        expect(data).toEqual(FEES)
        expect(error).toBeUndefined()
    })

    it('returns an error, and no table, when the backend refuses', async () => {
        mockServerFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Not Found' }) })
        const { data, error } = await getUsdPayoutRailFees()
        expect(data).toBeUndefined()
        expect(error).toBe('Not Found')
    })
})

describe('getExternalAccountPaymentRails', () => {
    it("returns the provider's supported rails", async () => {
        mockServerFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ id: 'ea-1', payment_rails: { supported: ['ach', 'ach_same_day'] } }),
        })
        const { data } = await getExternalAccountPaymentRails('cust 1', 'ea-1')
        expect(mockServerFetch.mock.calls[0][0]).toBe('/bridge/customers/cust%201/external-accounts/ea-1')
        expect(data).toEqual({ supported: ['ach', 'ach_same_day'] })
    })

    it('returns null when the provider does not say', async () => {
        mockServerFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'ea-1' }) })
        expect((await getExternalAccountPaymentRails('cust-1', 'ea-1')).data).toBeNull()
    })

    it('returns an error when the read fails', async () => {
        mockServerFetch.mockRejectedValue(new Error('timeout'))
        expect(await getExternalAccountPaymentRails('cust-1', 'ea-1')).toEqual({ error: 'timeout' })
    })
})
