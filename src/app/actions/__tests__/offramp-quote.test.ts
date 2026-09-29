/**
 * Withdrawals quoted in the bank currency (TASK-23054): the quote action that
 * prices either side, and the create action that sends the USDC as typed.
 */
const mockServerFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ serverFetch: (...args: unknown[]) => mockServerFetch(...args) }))

import { createOfframp, getOfframpQuote } from '../offramp'

const QUOTE = {
    destinationCurrency: 'eur',
    rate: '0.8955',
    updatedAt: '2026-09-24T15:54:16.373Z',
    destinationAmount: '2000.00',
    sourceAmount: '2233.39',
}

beforeEach(() => jest.clearAllMocks())

describe('getOfframpQuote', () => {
    it('asks for the typed bank amount and returns the quote', async () => {
        mockServerFetch.mockResolvedValue({ ok: true, json: async () => QUOTE })

        const { data, error } = await getOfframpQuote('eur', { destinationAmount: '2000.00' })

        expect(mockServerFetch).toHaveBeenCalledWith(
            '/bridge/offramp/quote?destinationCurrency=eur&destinationAmount=2000.00',
            expect.objectContaining({ method: 'GET' })
        )
        expect(data).toEqual(QUOTE)
        expect(error).toBeUndefined()
    })

    it('asks for the typed USDC when the user typed that side', async () => {
        const estimate = { ...QUOTE, sourceAmount: '12.01', destinationAmount: '10.75' }
        mockServerFetch.mockResolvedValue({ ok: true, json: async () => estimate })

        const { data } = await getOfframpQuote('eur', { sourceAmount: '12.01' })

        expect(mockServerFetch.mock.calls[0][0]).toBe(
            '/bridge/offramp/quote?destinationCurrency=eur&sourceAmount=12.01'
        )
        expect(data).toEqual(estimate)
    })

    it('asks for the rate only when there is no amount yet', async () => {
        mockServerFetch.mockResolvedValue({ ok: true, json: async () => ({ ...QUOTE, sourceAmount: undefined }) })

        await getOfframpQuote('gbp')

        expect(mockServerFetch.mock.calls[0][0]).toBe('/bridge/offramp/quote?destinationCurrency=gbp')
    })

    it('returns the API error instead of a quote', async () => {
        mockServerFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'no rate' }) })

        const { data, error } = await getOfframpQuote('eur', { destinationAmount: '2000.00' })

        expect(data).toBeUndefined()
        expect(error).toBe('no rate')
    })
})

describe('createOfframp', () => {
    const REQUEST = {
        amount: '12.01',
        onBehalfOf: 'cust-1',
        source: { currency: 'usdc', paymentRail: 'arbitrum', fromAddress: '0xuser' },
        destination: { currency: 'eur', paymentRail: 'sepa', externalAccountId: 'ext-1' },
    }

    it('sends the USDC amount as given', async () => {
        mockServerFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ transferId: 'tr-1', depositInstructions: { toAddress: '0xdead' } }),
        })

        await createOfframp(REQUEST)

        expect(JSON.parse(mockServerFetch.mock.calls[0][1].body)).toEqual({ ...REQUEST, provider: 'bridge' })
    })

    it('returns the API error with its code and status', async () => {
        mockServerFetch.mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({ error: 'The bank account cannot be used.', code: 'BANK_ACCOUNT_NOT_USABLE' }),
        })

        const result = await createOfframp(REQUEST)

        expect(result).toEqual({
            error: 'The bank account cannot be used.',
            code: 'BANK_ACCOUNT_NOT_USABLE',
            status: 409,
        })
    })
})
