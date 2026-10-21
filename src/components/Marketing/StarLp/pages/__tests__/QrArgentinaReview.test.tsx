import { render, screen } from '@testing-library/react'
import type { StarLpFxRate, StarLpFxReading } from '@/components/Marketing/StarLp/starLp.types'
import { QrArgentinaRateFold } from '../QrArgentinaRateFold'
import { QrArgentinaReview } from '../QrArgentinaReview'
import { formatUsdArsRate } from '../qrArgentinaRate.utils'

// The headline counting: `shown` is mid-count, far from the live rate.
const mockCountUp = jest.fn()
jest.mock('../useQrArgentinaRateCountUp', () => ({
    useQrArgentinaRateCountUp: (rate: number | null) => mockCountUp(rate),
}))

const quote = (rate: number): StarLpFxRate => ({
    from: 'USD',
    to: 'ARS',
    rate,
    source: 'manteca',
    fetchedAt: '2026-10-21T10:00:00.000Z',
    effectiveAt: '2026-10-21T09:59:59.000Z',
})

const LIVE: StarLpFxReading = { tier: 'live', quote: quote(1601.9) }
const LAST_KNOWN: StarLpFxReading = { tier: 'lastKnown', quote: quote(1412.34) }
const NONE: StarLpFxReading = { tier: 'none', quote: null }

const rateRow = () => screen.queryByTestId('qr-ar-rate-row')

beforeEach(() => mockCountUp.mockImplementation((rate: number | null) => ({ ref: () => {}, shown: rate })))

describe('QrArgentinaReview exchange-rate row (only the real live rate)', () => {
    it('prints the exact live rate', () => {
        render(<QrArgentinaReview usdArs={LIVE} />)
        expect(rateRow()).toHaveTextContent(`1 USD = ${formatUsdArsRate(1601.9)} ARS`)
        expect(screen.getByText(/≈ USD/)).toBeInTheDocument()
    })

    it.each([
        ['last-known', LAST_KNOWN],
        ['no', NONE],
    ])('drops the row and the dollar line with a %s rate', (_, reading) => {
        const { container } = render(<QrArgentinaReview usdArs={reading} />)
        expect(rateRow()).toBeNull()
        expect(container).not.toHaveTextContent(/1 USD|≈ USD|1,412/)
    })
})

describe('QrArgentinaRateFold', () => {
    it('keeps the live rate on the pay screen while the headline counts', () => {
        mockCountUp.mockImplementation(() => ({ ref: () => {}, shown: 1000 }))
        render(<QrArgentinaRateFold usdArs={LIVE} />)
        expect(rateRow()).toHaveTextContent(`1 USD = ${formatUsdArsRate(1601.9)} ARS`)
        expect(rateRow()).not.toHaveTextContent('1,000')
    })

    it('prints a last-known rate rounded after "≈", at rest, and names it "about"', () => {
        render(<QrArgentinaRateFold usdArs={LAST_KNOWN} />)
        expect(screen.getByRole('heading', { level: 2 })).toHaveAccessibleName('$1 is about 1,410 ARS')
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('$1 ≈')
        // no count-up for an old rate
        expect(mockCountUp).toHaveBeenLastCalledWith(null)
        expect(rateRow()).toBeNull()
    })

    it('says "Best rate" and prints no digits anywhere when there is no rate', () => {
        const { container } = render(<QrArgentinaRateFold usdArs={NONE} />)
        const headline = screen.getByRole('heading', { level: 2 })
        expect(headline).toHaveAccessibleName('Best rate')
        expect(headline).not.toHaveTextContent(/\d/)
        expect(container).not.toHaveTextContent(/1 USD|≈/)
        expect(mockCountUp).toHaveBeenLastCalledWith(null)
    })
})
