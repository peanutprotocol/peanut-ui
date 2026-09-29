import { type OfframpQuote } from '@/services/services.types'
import { isQuoteRecent, quoteAnswersRequest } from '../offramp-quote.utils'

const quote = (overrides: Partial<OfframpQuote> = {}): OfframpQuote => ({
    destinationCurrency: 'eur',
    rate: '0.8928135',
    updatedAt: '2026-09-24T15:54:16.373Z',
    destinationAmount: '2000.00',
    sourceAmount: '2240.11',
    ...overrides,
})

describe('quoteAnswersRequest', () => {
    it('matches the typed bank amount to the cent, whatever its format', () => {
        expect(quoteAnswersRequest(quote(), 'eur', { destinationAmount: '2000' })).toBe(true)
        expect(quoteAnswersRequest(quote(), 'EUR', { destinationAmount: '2000.00' })).toBe(true)
    })

    it('matches the typed USDC', () => {
        expect(quoteAnswersRequest(quote({ sourceAmount: '50.00' }), 'eur', { sourceAmount: '50' })).toBe(true)
        expect(quoteAnswersRequest(quote({ sourceAmount: '50.01' }), 'eur', { sourceAmount: '50' })).toBe(false)
    })

    it('refuses a quote for another amount or currency', () => {
        expect(quoteAnswersRequest(quote(), 'eur', { destinationAmount: '2000.01' })).toBe(false)
        expect(quoteAnswersRequest(quote(), 'gbp', { destinationAmount: '2000' })).toBe(false)
    })

    it('refuses an amount quote that lacks either amount', () => {
        expect(quoteAnswersRequest(quote({ sourceAmount: undefined }), 'eur', { destinationAmount: '2000' })).toBe(
            false
        )
        expect(quoteAnswersRequest(quote({ destinationAmount: undefined }), 'eur', { sourceAmount: '2240.11' })).toBe(
            false
        )
    })

    it('a rate-only request needs only the currency', () => {
        expect(
            quoteAnswersRequest(quote({ sourceAmount: undefined, destinationAmount: undefined }), 'eur', undefined)
        ).toBe(true)
    })
})

describe('isQuoteRecent', () => {
    it('is measured from when the app received the quote', () => {
        const receivedAt = 1_000_000
        expect(isQuoteRecent(receivedAt, receivedAt + 60_000)).toBe(true)
        expect(isQuoteRecent(receivedAt, receivedAt + 60_001)).toBe(false)
    })
})
