/**
 * Withdrawals typed in the bank currency (TASK-23054): the quote action that
 * turns a bank amount into the USDC to send.
 */
const mockServerFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ serverFetch: (...args: unknown[]) => mockServerFetch(...args) }))

import { getOfframpQuote } from '../offramp'

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

        const { data, error } = await getOfframpQuote('eur', '2000.00')

        expect(mockServerFetch).toHaveBeenCalledWith(
            '/bridge/offramp/quote?destinationCurrency=eur&destinationAmount=2000.00',
            expect.objectContaining({ method: 'GET' })
        )
        expect(data).toEqual(QUOTE)
        expect(error).toBeUndefined()
    })

    it('asks for the rate only when there is no amount yet', async () => {
        mockServerFetch.mockResolvedValue({ ok: true, json: async () => ({ ...QUOTE, sourceAmount: undefined }) })

        await getOfframpQuote('gbp')

        expect(mockServerFetch.mock.calls[0][0]).toBe('/bridge/offramp/quote?destinationCurrency=gbp')
    })

    it('returns the API error instead of a quote', async () => {
        mockServerFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'no rate' }) })

        const { data, error } = await getOfframpQuote('eur', '2000.00')

        expect(data).toBeUndefined()
        expect(error).toBe('no rate')
    })
})
