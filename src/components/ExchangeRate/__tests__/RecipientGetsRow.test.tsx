import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import RecipientGetsRow from '../RecipientGetsRow'

// One wording for every money-out screen (TASK-23054): the amount alone when
// the provider pays it exactly, "≈" when it converts at settlement.
describe('RecipientGetsRow', () => {
    it('an exact amount has no mark', () => {
        renderWithIntl(<RecipientGetsRow amount="2000" currency="eur" exact />)
        expect(screen.getByText('Recipient gets')).toBeInTheDocument()
        expect(screen.getByText('€2,000')).toBeInTheDocument()
    })

    it('an estimate is marked', () => {
        renderWithIntl(<RecipientGetsRow amount="1782.35" currency="gbp" exact={false} />)
        expect(screen.getByText('≈ £1,782.35')).toBeInTheDocument()
    })
})
