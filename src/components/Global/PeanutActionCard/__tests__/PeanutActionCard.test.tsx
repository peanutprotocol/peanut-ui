import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import PeanutActionCard from '../index'

describe('PeanutActionCard', () => {
    // Konrad, 2026-09-23: the request intro card says two lines and stops.
    it('reads two lines on the request card', () => {
        render(<PeanutActionCard type="request" />, { wrapper: IntlWrapper })

        expect(screen.getByText('Request money')).toBeInTheDocument()
        expect(screen.getByText('No account needed, just send a DM.')).toBeInTheDocument()
        expect(screen.queryByText('Perfect for WhatsApp and Messenger')).not.toBeInTheDocument()
    })

    // Hugo, 2026-09-25: the send card names the chat apps a link goes to
    it('shows the chat-apps line on the send card', () => {
        render(<PeanutActionCard type="send" />, { wrapper: IntlWrapper })

        expect(screen.getByText('Send with a link')).toBeInTheDocument()
        expect(screen.getByText('Perfect for WhatsApp and Messenger')).toBeInTheDocument()
        expect(screen.getByText('Anyone with the link can claim it')).toBeInTheDocument()
    })
})
