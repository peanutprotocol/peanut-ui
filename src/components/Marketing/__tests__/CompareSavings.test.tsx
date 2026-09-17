import { render, screen } from '@testing-library/react'
import { CompareSavings } from '../mdx/CompareSavings'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { getTranslations } from '@/i18n'

jest.mock('@/hooks/useExchangeRate', () => ({ useExchangeRate: jest.fn() }))

const mockUseExchangeRate = useExchangeRate as jest.Mock
const withRate = (exchangeRate: number) => mockUseExchangeRate.mockReturnValue({ exchangeRate })

// createMdxComponents injects the page locale's copy; the catalog itself is
// the real thing here so a broken placeholder shows up as a literal "{range}".
const en = getTranslations('en')

describe('CompareSavings', () => {
    beforeEach(() => mockUseExchangeRate.mockReset())

    it('renders a dated, concrete sentence with no live rate — this is what search engines see', () => {
        withRate(0)

        render(<CompareSavings strings={en} competitor="Wise" markupPct="0.4-1.5" verifiedAt="2026-08-10" />)

        const text = screen.getByText(/Wise/).textContent ?? ''
        expect(text).toContain('August 10, 2026')
        expect(text).toContain('0.4–1.5%')
        // Worst case on the default $500 base.
        expect(text).toContain('$7.5')
        expect(text).not.toContain('NaN')
    })

    it('adds local-currency amounts once a rate arrives', () => {
        withRate(1500)

        render(<CompareSavings strings={en} competitor="PayPal" markupPct="4" verifiedAt="2026-08-10" currency="ARS" />)

        const text = screen.getByText(/PayPal/).textContent ?? ''
        expect(text).toContain('750,000 ARS') // $500 × 1500
        expect(text).toContain('$20') // 4% of $500
        expect(text).toContain('30,000 ARS') // $20 × 1500
    })

    it('uses the upper bound of a range for the cost claim', () => {
        withRate(0)

        render(
            <CompareSavings
                strings={en}
                competitor="Revolut"
                markupPct="0-1"
                verifiedAt="2026-08-10"
                baseAmount="1000"
            />
        )

        expect(screen.getByText(/Revolut/).textContent).toContain('$10')
    })

    it('degrades to a dated sentence without amounts when a prop cannot be trusted', () => {
        withRate(1500)

        // The 100× trap in reverse: a percent field that is not a number at all.
        render(<CompareSavings strings={en} competitor="Western Union" markupPct="lots" verifiedAt="2026-08-10" />)

        const text = screen.getByText(/Western Union/).textContent ?? ''
        expect(text).toContain('2026-08-10')
        expect(text).not.toContain('ARS')
        expect(text).not.toContain('NaN')
        // The point of the rejection: the refused claim must not be republished.
        expect(text).not.toContain('lots')
        expect(text).not.toMatch(/\d+\s*%/)
    })

    it('rejects a negative percent instead of publishing it as a range', () => {
        withRate(0)

        // "-2" would split to ["", "2"] and Number('') is 0 — a silent "0–2%".
        render(<CompareSavings strings={en} competitor="Wise" markupPct="-2" verifiedAt="2026-08-10" />)

        const text = screen.getByText(/Wise/).textContent ?? ''
        expect(text).toContain('2026-08-10')
        expect(text).not.toContain('0–2')
        // Not as a range, and not as the raw claim either.
        expect(text).not.toContain('-2')
        expect(text).not.toMatch(/\d+\s*%/)
    })

    it('formats the verified date in UTC so the server and client agree', () => {
        withRate(0)

        // An ISO date is UTC midnight; formatting it in a western timezone
        // would render the previous day and mismatch the static HTML.
        render(<CompareSavings strings={en} competitor="Wise" markupPct="1" verifiedAt="2026-08-10" />)

        expect(screen.getByText(/Wise/).textContent).toContain('August 10, 2026')
    })

    it('rejects a calendar overflow instead of silently moving the verification date', () => {
        withRate(0)

        // new Date('2026-02-30') is 2 March — a typo would publish a date the
        // claim was never checked on.
        render(<CompareSavings strings={en} competitor="Wise" markupPct="1" verifiedAt="2026-02-30" />)

        const text = screen.getByText(/Wise/).textContent ?? ''
        expect(text).toContain('2026-02-30')
        expect(text).not.toContain('March')
    })

    it('renders the page locale, not English, once the content gate opens', () => {
        withRate(0)

        const ptBr = getTranslations('pt-br')
        render(<CompareSavings strings={ptBr} locale="pt-br" competitor="Wise" markupPct="1" verifiedAt="2026-08-10" />)

        const text = screen.getByText(/Wise/).textContent ?? ''
        expect(text).toContain('A taxa do Peanut')
        expect(text).not.toContain('to convert your money')
        expect(text).not.toMatch(/\{\w+\}/)
    })

    it('never renders empty on an unparsable date', () => {
        withRate(1500)

        render(<CompareSavings strings={en} competitor="Wise" markupPct="1" verifiedAt="whenever" />)

        expect(screen.getByText(/Wise/).textContent).toContain('whenever')
    })

    // MDX is runtime data: a prop can be omitted, and mdx-security admits inert
    // literals like markupPct={1}. Either one used to reach .replace() and throw,
    // which fails the static build of every compare page.
    it('takes the unverified lane when markupPct is missing', () => {
        withRate(1500)

        // @ts-expect-error — MDX does not enforce the prop types at runtime
        expect(() => render(<CompareSavings strings={en} competitor="Wise" verifiedAt="2026-08-10" />)).not.toThrow()

        // the degraded lane has no parsed claim, so it prints the raw date it
        // was given rather than a formatted one
        const text = screen.getByText(/Wise/).textContent ?? ''
        expect(text).toContain('2026-08-10')
        expect(text).not.toMatch(/\d+\s*%/)
        expect(text).not.toContain('undefined')
    })

    it('takes the unverified lane when markupPct is a number literal', () => {
        withRate(1500)

        expect(() =>
            // @ts-expect-error — mdx-security allows an inert numeric literal prop
            render(<CompareSavings strings={en} competitor="Wise" markupPct={1} verifiedAt="2026-08-10" />)
        ).not.toThrow()

        const text = screen.getByText(/Wise/).textContent ?? ''
        expect(text).not.toMatch(/\d+\s*%/)
    })

    it('renders nothing when neither the fee nor the date is usable', () => {
        withRate(1500)

        const { container } = render(
            // @ts-expect-error — both hand-authored props omitted
            <CompareSavings strings={en} competitor="Wise" />
        )

        expect(container).toBeEmptyDOMElement()
    })
})
