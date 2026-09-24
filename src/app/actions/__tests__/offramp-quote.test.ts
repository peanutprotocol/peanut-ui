/**
 * Exact-amount withdrawals (TASK-23054): the quote action, and the create
 * action handing back the new quote when the rate moved past the confirmed
 * amount.
 */
const mockServerFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ serverFetch: (...args: unknown[]) => mockServerFetch(...args) }))

import { createOfframp, getOfframpQuote } from '../offramp'

const QUOTE = {
    destinationCurrency: 'eur',
    rate: '0.89104478',
    updatedAt: '2026-09-24T15:54:16.373Z',
    destinationAmount: '2000.00',
    sourceAmount: '2244.56',
}

beforeEach(() => jest.clearAllMocks())

describe('getOfframpQuote', () => {
    it('asks for the exact bank amount and returns the quote', async () => {
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

describe('createOfframp — rate moved past the confirmed amount', () => {
    it('returns the code and the new quote, nothing else', async () => {
        mockServerFetch.mockResolvedValue({
            ok: false,
            json: async () => ({
                error: 'The exchange rate changed. Check the new amount.',
                code: 'OFFRAMP_QUOTE_CHANGED',
                quote: { ...QUOTE, sourceAmount: '2258.43' },
            }),
        })

        const result = await createOfframp({ amount: '2244.56', destinationAmount: '2000.00' } as never)

        expect(result.data).toBeUndefined()
        expect(result.code).toBe('OFFRAMP_QUOTE_CHANGED')
        expect(result.quote?.sourceAmount).toBe('2258.43')
    })
})
