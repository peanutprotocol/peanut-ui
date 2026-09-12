import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { ClaimLoadingView } from '../views/ClaimLoading.view'

describe('ClaimLoadingView', () => {
    it('shows the loading message on the first request', () => {
        renderWithIntl(<ClaimLoadingView failureCount={0} />)

        expect(screen.getByText('Loading your link...')).toBeInTheDocument()
    })

    it('keeps the loading message through early retries', () => {
        renderWithIntl(<ClaimLoadingView failureCount={2} />)

        expect(screen.getByText('Loading your link...')).toBeInTheDocument()
        expect(screen.queryByText(/taking longer/i)).not.toBeInTheDocument()
    })

    it('switches to the retry copy after three failures', () => {
        renderWithIntl(<ClaimLoadingView failureCount={3} />)

        expect(screen.getByText(/taking longer than usual/i)).toBeInTheDocument()
        expect(screen.getByText(/attempt 4\/5/)).toBeInTheDocument()
    })
})
