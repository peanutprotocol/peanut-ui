import { requestAmountFromInput, toApiAmount, usdEquivalent } from '../requestCurrency'

describe('usdEquivalent', () => {
    // the rate is units of the request currency per dollar
    it('converts the asked amount into dollars', () => {
        expect(usdEquivalent('100', 0.8)).toBe('125.00')
        expect(usdEquivalent('13500', 1350)).toBe('10.00')
    })

    it('gives nothing without an amount or a rate', () => {
        expect(usdEquivalent('', 0.8)).toBe('')
        expect(usdEquivalent('0', 0.8)).toBe('')
        expect(usdEquivalent('abc', 0.8)).toBe('')
        expect(usdEquivalent('100', 0)).toBe('')
    })
})

describe('toApiAmount', () => {
    it.each([
        ['.5', '0.5'],
        ['100.', '100'],
        [' 12.50 ', '12.50'],
        ['7', '7'],
    ])('sends %p as %p, the shape the API accepts', (typed, sent) => {
        expect(toApiAmount(typed)).toBe(sent)
        expect(toApiAmount(typed)).toMatch(/^\d+(\.\d+)?$/)
    })
})

describe('requestAmountFromInput', () => {
    // 0.8498 EUR per dollar: $50 is 42.49 EUR cut off, and 42.49 EUR is $49.99
    const RATE = 0.8498

    it('rounds up to the minor unit when the requester typed dollars', () => {
        const sides = { primary: '42.49', secondary: '50', displayed: '50' }
        expect(requestAmountFromInput(sides, 'EUR', RATE)).toBe('42.49')
        expect(requestAmountFromInput({ ...sides, primary: '42.48' }, 'EUR', 0.84975)).toBe('42.49')
        // never below what was typed
        expect(Number(requestAmountFromInput(sides, 'EUR', RATE)) / RATE).toBeGreaterThanOrEqual(50 - 0.005)
    })

    it('uses no decimals for a currency that has none', () => {
        expect(requestAmountFromInput({ primary: '7342', secondary: '50', displayed: '50' }, 'JPY', 146.857)).toBe(
            '7343'
        )
    })

    it('takes the typed amount as it is in the request currency', () => {
        expect(requestAmountFromInput({ primary: '100', secondary: '117.67', displayed: '100' }, 'EUR', RATE)).toBe(
            '100'
        )
    })

    it('takes the primary side for a dollar request, and while there is no rate', () => {
        expect(requestAmountFromInput({ primary: '25', secondary: '', displayed: '25' }, 'USD', 0)).toBe('25')
        expect(requestAmountFromInput({ primary: '', secondary: '50', displayed: '50' }, 'EUR', 0)).toBe('')
    })
})
