import { type OfframpQuote } from '@/services/services.types'
import {
    isBridgeQuoteRefusal,
    isFixedOutputQuote,
    isFixedOutputQuoteRecent,
    quoteAnswersRequest,
} from '../offramp-quote.utils'

const quote = (overrides: Partial<OfframpQuote> = {}): OfframpQuote => ({
    destinationCurrency: 'eur',
    rate: '0.8928135',
    updatedAt: '2026-09-24T15:54:16.373Z',
    destinationAmount: '2000.00',
    sourceAmount: '2240.11',
    pricing: 'fixed_output',
    quoteId: 'quote-1',
    expiresAt: '2026-09-24T15:56:16.373Z',
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

describe('isFixedOutputQuote', () => {
    it('is true only for a fixed_output quote with a quoteId', () => {
        expect(isFixedOutputQuote(quote())).toBe(true)
        // the rate-only answer under fixed_output pricing binds nothing
        expect(isFixedOutputQuote(quote({ quoteId: undefined }))).toBe(false)
        expect(isFixedOutputQuote(quote({ pricing: 'bridge_rate', quoteId: undefined }))).toBe(false)
    })
})

describe('isFixedOutputQuoteRecent', () => {
    it('is measured from when the app received the quote', () => {
        const receivedAt = 1_000_000
        expect(isFixedOutputQuoteRecent(receivedAt, receivedAt + 60_000)).toBe(true)
        expect(isFixedOutputQuoteRecent(receivedAt, receivedAt + 60_001)).toBe(false)
    })
})

describe('isBridgeQuoteRefusal', () => {
    it.each([
        'BRIDGE_QUOTE_INVALID',
        'BRIDGE_QUOTE_EXPIRED',
        'BRIDGE_QUOTE_MISMATCH',
        'BRIDGE_QUOTE_STALE',
        'BRIDGE_QUOTE_USED',
    ])('%s is a quote refusal', (code) => {
        expect(isBridgeQuoteRefusal(code)).toBe(true)
    })

    it('other errors are not', () => {
        expect(isBridgeQuoteRefusal(undefined)).toBe(false)
        expect(isBridgeQuoteRefusal('BRIDGE_TOS_REQUIRED')).toBe(false)
    })
})
