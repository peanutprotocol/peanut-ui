import { toError } from '@/utils/to-error'

describe('toError', () => {
    it('passes an Error through untouched', () => {
        const err = new TypeError('boom')
        expect(toError(err)).toBe(err)
    })

    it('preserves a DOMException subclass identity', () => {
        const err = new DOMException('denied', 'NotAllowedError')
        expect(toError(err)).toBe(err)
    })

    // qr-scanner rejects with bare strings
    it('wraps a thrown string', () => {
        expect(toError('Camera not found.').message).toBe('Camera not found.')
    })

    /*
     * The case that motivated the helper: a plain object stringifies to
     * '[object Object]', so the payload was lost from the Sentry title as well
     * as the stack.
     */
    it('serializes a plain object instead of stringifying it', () => {
        expect(toError({ code: 'INSUFFICIENT_FUNDS', chainId: 42161 }).message).toBe(
            '{"code":"INSUFFICIENT_FUNDS","chainId":42161}'
        )
    })

    it('falls back to String() on a circular object', () => {
        const circular: Record<string, unknown> = { a: 1 }
        circular.self = circular
        expect(toError(circular).message).toBe('[object Object]')
    })

    it('handles null and undefined', () => {
        expect(toError(null).message).toBe('null')
        expect(toError(undefined).message).toBe('undefined')
    })

    it('always returns something captureConsole will attach a stack to', () => {
        for (const value of ['s', 42, null, undefined, { a: 1 }, new Error('e')]) {
            expect(toError(value)).toBeInstanceOf(Error)
            expect(toError(value).stack).toBeTruthy()
        }
    })
})
