import { validateNumericResponse } from '@/lib/numeric-response'

jest.mock('@/utils/sentry-lazy', () => ({ captureMessage: jest.fn() }))

const amountFields = [
    'amount',
    'tokenAmount',
    'usdAmount',
    'totalCollectedAmount',
    'totalBalance',
    'receivedAmount',
    'remainingAmount',
    'requestAmount',
    'netAmount',
    'fee',
]
const rateFields = ['price', 'rate', 'netRate', 'grossRate', 'buy_rate', 'sell_rate', 'midmarket_rate']

describe('provider numeric response boundary', () => {
    it('returns the original immutable response and preserves unknown metadata', () => {
        const item = Object.freeze({ amount: '12.30', price: '1.25', memo: 'NaN', reference: '1e4', optional: null })
        const response = Object.freeze({ items: Object.freeze([item]), amount: null })
        expect(validateNumericResponse(response)).toBe(response)
        expect(response.items[0]).toBe(item)
        expect(response.items[0].amount).toBe('12.30')
    })

    it.each([...amountFields, ...rateFields])('validates present scalar field %s', (field) => {
        for (const raw of ['', ' ', 'NaN', 'Infinity', '12usd', '1,000', '1e3', true, '9'.repeat(400)]) {
            expect(() => validateNumericResponse({ outer: [{ [field]: raw }] })).toThrow(Error)
        }
        expect(validateNumericResponse({ [field]: null })).toEqual({ [field]: null })
        expect(validateNumericResponse({ [field]: '1.25' })).toEqual({ [field]: '1.25' })
    })

    it.each(rateFields)('requires positive %s', (field) => {
        for (const raw of [0, -1, '0', '-1.25']) expect(() => validateNumericResponse({ [field]: raw })).toThrow(Error)
    })

    it.each(amountFields)('permits finite signed amount/fee field %s', (field) => {
        expect(validateNumericResponse({ [field]: '-1.25' })).toEqual({ [field]: '-1.25' })
        expect(validateNumericResponse({ [field]: 0 })).toEqual({ [field]: 0 })
    })

    it('rejects nonfinite numeric values even under unknown names or inside arrays', () => {
        for (const raw of [NaN, Infinity, -Infinity]) {
            expect(() => validateNumericResponse(raw)).toThrow(Error)
            expect(() => validateNumericResponse({ metadata: { arbitrary: [raw] } })).toThrow(Error)
        }
    })

    it('traverses nested money wrappers', () => {
        expect(validateNumericResponse({ amount: { amount: '12.34', currency: 'USD' } })).toEqual({
            amount: { amount: '12.34', currency: 'USD' },
        })
        expect(() => validateNumericResponse({ amount: { amount: '12private', currency: 'USD' } })).toThrow(Error)
    })

    it('keeps rejected raw data out of errors and emitted telemetry', () => {
        const { captureMessage } = jest.requireMock('@/utils/sentry-lazy')
        const secret = 'person@example.com:wallet:123.45'
        let caught: unknown
        try {
            validateNumericResponse({ amount: secret })
        } catch (error) {
            caught = error
        }
        expect(caught).toBeInstanceOf(Error)
        expect(String(caught)).not.toContain(secret)
        expect(JSON.stringify(caught)).not.toContain(secret)
        expect(JSON.stringify(captureMessage.mock.calls)).not.toContain(secret)
    })

    it('rejects oversized traversal with a safe Error', () => {
        expect(() => validateNumericResponse(Array.from({ length: 100001 }, () => 1))).toThrow(Error)
        let nested: unknown = 'leaf'
        for (let depth = 0; depth < 34; depth++) nested = { child: nested }
        expect(() => validateNumericResponse(nested)).toThrow(Error)
    })

    it('accepts a bounded nested workload without changing identity', () => {
        const response = Array.from({ length: 1000 }, (_, index) => ({
            amount: `${index}.25`,
            rate: 2,
            memo: 'unchanged',
        }))
        expect(validateNumericResponse(response)).toBe(response)
        expect(response[999]).toEqual({ amount: '999.25', rate: 2, memo: 'unchanged' })
    })
})
