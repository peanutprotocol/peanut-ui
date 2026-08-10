import { render, screen } from '@testing-library/react'
import { CompareSavings } from '../CompareSavings'
import { useExchangeRate } from '@/hooks/useExchangeRate'

jest.mock('@/hooks/useExchangeRate', () => ({ useExchangeRate: jest.fn() }))

const mockUseExchangeRate = useExchangeRate as jest.Mock
const withRate = (exchangeRate: number) => mockUseExchangeRate.mockReturnValue({ exchangeRate })

describe('CompareSavings', () => {
    beforeEach(() => mockUseExchangeRate.mockReset())

    it('renders a dated, concrete sentence with no live rate — this is what search engines see', () => {
        withRate(0)

        render(<CompareSavings competitor="Wise" markupPct="0.4-1.5" verifiedAt="2026-08-10" />)

        const text = screen.getByText(/Wise/).textContent ?? ''
        expect(text).toContain('August 10, 2026')
        expect(text).toContain('0.4–1.5%')
        // Worst case on the default $500 base.
        expect(text).toContain('$7.5')
        expect(text).not.toContain('NaN')
    })

    it('adds local-currency amounts once a rate arrives', () => {
        withRate(1500)

        render(<CompareSavings competitor="PayPal" markupPct="4" verifiedAt="2026-08-10" currency="ARS" />)

        const text = screen.getByText(/PayPal/).textContent ?? ''
        expect(text).toContain('750,000 ARS') // $500 × 1500
        expect(text).toContain('$20') // 4% of $500
        expect(text).toContain('30,000 ARS') // $20 × 1500
    })

    it('uses the upper bound of a range for the cost claim', () => {
        withRate(0)

        render(<CompareSavings competitor="Revolut" markupPct="0-1" verifiedAt="2026-08-10" baseAmount="1000" />)

        expect(screen.getByText(/Revolut/).textContent).toContain('$10')
    })

    it('degrades to a dated sentence without amounts when a prop cannot be trusted', () => {
        withRate(1500)

        // The 100× trap in reverse: a percent field that is not a number at all.
        render(<CompareSavings competitor="Western Union" markupPct="lots" verifiedAt="2026-08-10" />)

        const text = screen.getByText(/Western Union/).textContent ?? ''
        expect(text).toContain('2026-08-10')
        expect(text).not.toContain('ARS')
        expect(text).not.toContain('NaN')
    })

    it('never renders empty on an unparsable date', () => {
        withRate(1500)

        render(<CompareSavings competitor="Wise" markupPct="1" verifiedAt="whenever" />)

        expect(screen.getByText(/Wise/).textContent).toContain('whenever')
    })
})
