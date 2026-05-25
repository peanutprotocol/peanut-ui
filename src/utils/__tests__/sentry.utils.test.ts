import { sanitizeRequestBody } from '../sentry.utils'

describe('sanitizeRequestBody', () => {
    it('redacts the PIN-set endpoint body', () => {
        const body = JSON.stringify({ pin: '1234' })
        expect(sanitizeRequestBody('https://api.peanut.me/rain/cards/abc-123/pin', body)).toBe('[REDACTED]')
    })

    it('redacts regardless of cardId shape', () => {
        const body = JSON.stringify({ pin: '0000' })
        expect(sanitizeRequestBody('/rain/cards/00000000-0000-0000-0000-000000000000/pin', body)).toBe('[REDACTED]')
    })

    it('passes non-sensitive bodies through unchanged', () => {
        const body = JSON.stringify({ amount: 1000 })
        expect(sanitizeRequestBody('https://api.peanut.me/rain/cards/abc-123/withdraw/submit', body)).toBe(body)
    })

    it('returns null for null/undefined bodies', () => {
        expect(sanitizeRequestBody('/rain/cards/abc-123/pin', null)).toBeNull()
        expect(sanitizeRequestBody('/rain/cards/abc-123/pin', undefined)).toBeNull()
    })

    it('does not over-match — /pin must be a path segment, not a substring', () => {
        const body = JSON.stringify({ thing: 'pin-pad' })
        expect(sanitizeRequestBody('/rain/cards/abc-123/pinpad-config', body)).toBe(body)
    })
})
