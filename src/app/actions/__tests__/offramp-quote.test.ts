/**
 * Withdrawals quoted in the bank currency (TASK-23054) and fees v2: the quote
 * action that prices either side, and the create action that passes its quoteId.
 */
const mockServerFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ serverFetch: (...args: unknown[]) => mockServerFetch(...args) }))

import { createOfframp, getOfframpQuote } from '../offramp'

const QUOTE = {
    destinationCurrency: 'eur',
    rate: '0.8928135',
    updatedAt: '2026-09-24T15:54:16.373Z',
    destinationAmount: '2000.00',
    sourceAmount: '2240.11',
    pricing: 'fixed_output',
    quoteId: 'signed.quote',
    expiresAt: '2026-09-24T15:56:16.373Z',
}

beforeEach(() => jest.clearAllMocks())

describe('getOfframpQuote', () => {
    it('asks for fixed_output pricing of the typed bank amount and returns the quote', async () => {
        mockServerFetch.mockResolvedValue({ ok: true, json: async () => QUOTE })

        const { data, error } = await getOfframpQuote('eur', { destinationAmount: '2000.00' })

        expect(mockServerFetch).toHaveBeenCalledWith(
            '/bridge/offramp/quote?destinationCurrency=eur&pricing=fixed_output&destinationAmount=2000.00',
            expect.objectContaining({ method: 'GET' })
        )
        expect(data).toEqual(QUOTE)
        expect(error).toBeUndefined()
    })

    it('asks for the typed USDC when the user typed that side', async () => {
        mockServerFetch.mockResolvedValue({ ok: true, json: async () => QUOTE })

        await getOfframpQuote('eur', { sourceAmount: '50' })

        expect(mockServerFetch.mock.calls[0][0]).toBe(
            '/bridge/offramp/quote?destinationCurrency=eur&pricing=fixed_output&sourceAmount=50'
        )
    })

    it('asks for the rate only when there is no amount yet', async () => {
        mockServerFetch.mockResolvedValue({ ok: true, json: async () => ({ ...QUOTE, sourceAmount: undefined }) })

        await getOfframpQuote('gbp')

        expect(mockServerFetch.mock.calls[0][0]).toBe(
            '/bridge/offramp/quote?destinationCurrency=gbp&pricing=fixed_output'
        )
    })

    it('returns a Bridge-rate answer unchanged (margin off)', async () => {
        const legacy = { ...QUOTE, rate: '0.8955', sourceAmount: '2233.39', pricing: 'bridge_rate' }
        delete (legacy as Partial<typeof QUOTE>).quoteId
        delete (legacy as Partial<typeof QUOTE>).expiresAt
        mockServerFetch.mockResolvedValue({ ok: true, json: async () => legacy })

        const { data } = await getOfframpQuote('eur', { destinationAmount: '2000.00' })

        expect(data).toEqual(legacy)
    })

    it('returns the API error instead of a quote', async () => {
        mockServerFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'no rate' }) })

        const { data, error } = await getOfframpQuote('eur', { destinationAmount: '2000.00' })

        expect(data).toBeUndefined()
        expect(error).toBe('no rate')
    })
})

describe('createOfframp with a quote', () => {
    const REQUEST = {
        amount: '2240.11',
        onBehalfOf: 'cust-1',
        source: { currency: 'usdc', paymentRail: 'arbitrum', fromAddress: '0xuser' },
        destination: { currency: 'eur', paymentRail: 'sepa', externalAccountId: 'ext-1' },
        quoteId: 'signed.quote',
    }

    it('sends the quoteId to create', async () => {
        mockServerFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ transferId: 'tr-1', depositInstructions: { toAddress: '0xdead' } }),
        })

        await createOfframp(REQUEST)

        expect(JSON.parse(mockServerFetch.mock.calls[0][1].body)).toEqual({ ...REQUEST, provider: 'bridge' })
    })

    it('returns the refusal code and status, so the app can requote', async () => {
        mockServerFetch.mockResolvedValue({
            ok: false,
            status: 409,
            json: async () => ({ error: 'The exchange rate changed. Get a new quote.', code: 'BRIDGE_QUOTE_STALE' }),
        })

        const result = await createOfframp(REQUEST)

        expect(result).toEqual({
            error: 'The exchange rate changed. Get a new quote.',
            code: 'BRIDGE_QUOTE_STALE',
            status: 409,
        })
    })
})
