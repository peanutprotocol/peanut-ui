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
        ['1.239', '1.23'], // floors to the denomination's decimals, never rounds up
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

    // ---- bugs: recorded with it.failing so the suite stays green. when one
    // starts passing, jest fails it — flip it to `it` then. ----

    // bug: a 3-digit fraction after a comma is read as a thousands group, so a
    // pasted "0,125" (es/pt for 0.125) sends 125 — a 1000x amount. no locale
    // writes a thousands group after a leading 0, so this one is unambiguous.
    it.failing('pasted "0,125" sends 0.12, not 125', () => {
        const { type, sent } = renderField()
        type('0,125')
        expect(sent()).toBe('0.12')
    })

    // bug: same heuristic — ",500" inside "12,5000" is stripped as a thousands
    // group, so 12.5 becomes 125000. no locale uses 4-digit groups.
    it.failing('pasted "12,5000" sends 12.50, not 125000', () => {
        const { type, sent } = renderField()
        type('12,5000')
        expect(sent()).toBe('12.50')
    })

    // bug: es/pt thousands dots plus a decimal comma are rejected and the field
    // is wiped, so a value copied from a pt-BR/es-AR bank app never pastes
    it.failing.each([
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

    // bug: any invalid keystroke empties the whole field instead of being
    // ignored — one stray letter wipes the amount the user already typed
    it.failing('a stray letter keeps the amount already typed', () => {
        const { input, type } = renderField()
        type('12')
        type('12a')
        expect(input.value).toBe('12')
    })
})
