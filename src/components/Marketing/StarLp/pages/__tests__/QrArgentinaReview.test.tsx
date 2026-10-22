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
const rateLine = () => screen.getByTestId('qr-ar-rate-line')

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
    it('keeps the live rate on the pay screen while the rate line counts', () => {
        mockCountUp.mockImplementation(() => ({ ref: () => {}, shown: 1000 }))
        render(<QrArgentinaRateFold usdArs={LIVE} />)
        expect(rateRow()).toHaveTextContent(`1 USD = ${formatUsdArsRate(1601.9)} ARS`)
        expect(rateRow()).not.toHaveTextContent('1,000')
    })

    // pricing.md: the dated example only with its date, USD funding, the assumed fee and "indicative" together
    it('headlines the dated saving with its footnote, whatever the rate tier', () => {
        render(<QrArgentinaRateFold usdArs={NONE} />)
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('About 6% less than a foreign card.*')
        expect(screen.getByText(/^\*Indicative comparison on 22 Sep 2026/)).toHaveTextContent(
            /USD-funded .* 6\.02% less .* assumed 3% issuer fee\. Not a live result\./
        )
    })

    it('prints a last-known rate rounded after "≈", at rest, and names it "about"', () => {
        render(<QrArgentinaRateFold usdArs={LAST_KNOWN} />)
        expect(rateLine()).toHaveTextContent('$1 is about 1,410 ARS')
        expect(rateLine()).toHaveTextContent('$1 ≈')
        // no count-up for an old rate
        expect(mockCountUp).toHaveBeenLastCalledWith(null)
        expect(rateRow()).toBeNull()
    })

    it('says "Best rate" and prints no rate anywhere when there is no rate', () => {
        const { container } = render(<QrArgentinaRateFold usdArs={NONE} />)
        expect(rateLine()).toHaveTextContent('Best rate')
        expect(rateLine()).not.toHaveTextContent(/\d/)
        expect(container).not.toHaveTextContent(/1 USD|≈/)
        expect(mockCountUp).toHaveBeenLastCalledWith(null)
    })
})
