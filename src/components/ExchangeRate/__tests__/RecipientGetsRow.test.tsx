import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import RecipientGetsRow from '../RecipientGetsRow'

// One wording for every money-out screen (TASK-23054): the bank amount is an
// estimate, because the provider converts at settlement.
describe('RecipientGetsRow', () => {
    it('marks the amount as approximate, with no ".00" on a round amount', () => {
        renderWithIntl(<RecipientGetsRow amount="2000" currency="eur" />)
        expect(screen.getByText('Recipient gets')).toBeInTheDocument()
        expect(screen.getByText('≈ €2,000')).toBeInTheDocument()
    })

    it('keeps cents when there are any', () => {
        renderWithIntl(<RecipientGetsRow amount="1782.5" currency="gbp" />)
        expect(screen.getByText('≈ £1,782.50')).toBeInTheDocument()
    })

    // a fixed_output offramp pays out exactly this amount
    it('an exact amount has no "≈"', () => {
        renderWithIntl(<RecipientGetsRow amount="2000.00" currency="eur" isExact />)
        expect(screen.getByText('€2,000')).toBeInTheDocument()
        expect(screen.queryAllByText(/≈/)).toHaveLength(0)
    })
})
