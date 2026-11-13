import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { parseUsdAmountToUnits } from '@/utils/balance.utils'
import AmountInput from '..'

// TASK-23132: hostile values typed or pasted into the amount field. What the
// parent receives through setPrimaryAmount is the amount the app would send,
// so every case asserts that string, not just what the field shows.
// The parser is formatTokenAmount(value, decimals, true) in utils/general.utils.

function renderField(decimals = 2) {
    const primary = jest.fn()
    renderWithIntl(<AmountInput primaryDenomination={{ symbol: '$', price: 1, decimals }} setPrimaryAmount={primary} />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    const type = (value: string) => fireEvent.change(input, { target: { value } })
    const sent = () => primary.mock.calls.at(-1)?.[0] as string | undefined
    return { input, type, sent }
}

describe('AmountInput with hostile values', () => {
    it.each([
        // [typed or pasted, amount sent]
        ['0,5', '0.5'], // comma as decimal separator (es/pt)
        ['1,000.50', '1000.50'], // en paste with a thousands comma
        ['.5', '.5'],
        ['12\n', '12'], // a text input drops line breaks natively, so a pasted newline never reaches the parser
        [' 12 ', '12'],
        ['1.2399', '1.23'], // floors to the denomination's decimals, never rounds up ("1.239" is ambiguous, see below)
        ['999999999.99', '999999999.99'],
        ['0', '0'],
        ['', ''],
    ])('%j sends %j', (value, expected) => {
        const { type, sent } = renderField()
        type(value)
        expect(sent()).toBe(expected)
    })

    it.each(['-5', '1e21', '1.2.3', 'abc'])('%j is rejected and sends nothing', (value) => {
        const { type, sent } = renderField()
        type(value)
        expect(sent()).toBe('')
    })

    it('leading zeros still mean the same amount', () => {
        const { type, sent } = renderField()
        type('00012')
        expect(parseUsdAmountToUnits(sent()!)).toBe(12_000_000n)
    })

    it('cuts a fraction longer than the token supports (USDC, 6 decimals)', () => {
        const { type, sent } = renderField(6)
        type('1.1234567')
        expect(sent()).toBe('1.123456')
        expect(parseUsdAmountToUnits(sent()!)).toBe(1_123_456n)
    })

    // a single comma is a decimal comma. this used to read "0,125" as a
    // thousands group and send 125, a 1000x amount.
    it('pasted "0,125" sends 0.12, not 125', () => {
        const { type, sent } = renderField()
        type('0,125')
        expect(sent()).toBe('0.12')
    })

    it('pasted "12,5000" sends 12.50, not 125000', () => {
        const { type, sent } = renderField()
        type('12,5000')
        expect(sent()).toBe('12.50')
    })

    // es/pt thousands dots with a decimal comma, a currency sign or space
    // groups used to be rejected and wiped the field, so a value copied from a
    // pt-BR/es-AR bank app never pasted (TASK-23499)
    it.each([
        ['1.000,50', '1000.50'],
        ['R$ 1.234,56', '1234.56'],
        ['$ 12', '12'],
        ['$12', '12'],
        ['1 234,56', '1234.56'],
    ])('pasted %j sends %j', (value, expected) => {
        const { type, sent } = renderField()
        type(value)
        expect(sent()).toBe(expected)
    })

    it('a stray letter keeps the amount already typed', () => {
        const { input, type, sent } = renderField()
        type('12')
        type('12a')
        expect(input.value).toBe('12')
        expect(sent()).toBe('12')
    })

    it('a rejected paste over a typed amount keeps that amount', () => {
        const { input, type, sent } = renderField()
        type('12')
        type('1.2.3')
        expect(input.value).toBe('12')
        expect(sent()).toBe('12')
    })

    it('clearing the field still empties it', () => {
        const { input, type, sent } = renderField()
        type('12')
        type('')
        expect(input.value).toBe('')
        expect(sent()).toBe('')
    })

    // one separator before exactly 3 digits is a thousand in es/pt and a decimal
    // in en. a wrong guess is a 1000x amount, so the field refuses it and keeps
    // what it held (TASK-23499, decision C)
    it.each(['125.000', '1,000', '$1,000', 'R$ 1.000'])('pasted %j is refused, never guessed', (value) => {
        const { input, type, sent } = renderField()
        type('12')
        type(value)
        expect(input.value).toBe('12')
        expect(sent()).toBe('12')
    })

    it.each([
        ['1.000,50', '1000.50'],
        ['1,000.50', '1000.50'],
        ['12.5', '12.5'],
        ['0,125', '0.12'],
    ])('pasted %j still sends %j', (value, expected) => {
        const { type, sent } = renderField()
        type(value)
        expect(sent()).toBe(expected)
    })

    // typing is not pasting: the user already sees the point they typed
    it('a 6-decimal field still takes a third decimal typed after the point', () => {
        const { type, sent } = renderField(6)
        type('1.23')
        type('1.234')
        expect(sent()).toBe('1.234')
    })

    it('a 2-decimal field still cuts a third decimal typed after the point', () => {
        const { input, type, sent } = renderField()
        type('1.23')
        type('1.234')
        expect(input.value).toBe('1.23')
        expect(sent()).toBe('1.23')
    })
})
