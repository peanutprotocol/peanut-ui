import { screen } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import VerificationDeadlineNotice from '../VerificationDeadlineNotice'

describe('VerificationDeadlineNotice', () => {
    it('names the request and its UTC deadline, and has no action that could hold the transfer', () => {
        render(<VerificationDeadlineNotice effectiveDate="2099-10-01" />)

        const notice = screen.getByTestId('verification-deadline-notice')
        expect(notice).toHaveTextContent('One more document needed')
        // date-only string: the deadline must not slip to September 30 west of UTC
        expect(notice).toHaveTextContent('Due October 1, 2099.')
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('an unparseable date renders nothing rather than a notice without its deadline', () => {
        const { container } = render(<VerificationDeadlineNotice effectiveDate="not-a-date" />)
        expect(container).toBeEmptyDOMElement()
    })
})
