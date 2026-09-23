import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import PeanutActionCard from '../index'

describe('PeanutActionCard', () => {
    // Konrad, 2026-09-23: the request intro card says two lines and stops.
    it('reads two lines on the request card', () => {
        render(<PeanutActionCard type="request" />, { wrapper: IntlWrapper })

        expect(screen.getByText('Request money')).toBeInTheDocument()
        expect(screen.getByText('No account needed, just send a DM.')).toBeInTheDocument()
        expect(screen.queryByAltText('Socials')).not.toBeInTheDocument()
    })

    it('keeps the socials line on the send card', () => {
        render(<PeanutActionCard type="send" />, { wrapper: IntlWrapper })

        expect(screen.getByText('Perfect to DM friends!')).toBeInTheDocument()
    })
})
