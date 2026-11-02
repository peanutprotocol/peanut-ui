import { render, screen } from '@testing-library/react'
import { UsEuRequestStrips } from '../pages/UsEuRequestStrips'

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }), useOptionalAuth: () => ({ user: null }) }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
jest.mock('@/components/Migration/AppModalProvider', () => ({ useAppModal: () => () => false }))

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

describe('UsEuRequestStrips', () => {
    it('keeps the three-beat, linked story of /us-europe-accounts by default', () => {
        const { container } = render(<UsEuRequestStrips />)
        expect(screen.getByRole('img')).toHaveAccessibleName(
            'Chat: Mengano asks where to pay; Fulano sends a Peanut request link for $250; Mengano paid'
        )
        expect(container.querySelectorAll('[data-story-beat]')).toHaveLength(3)
        expect(screen.getByText('Where do I pay you?')).toBeInTheDocument()
        expect(screen.getByText('fulano is requesting')).toBeInTheDocument()
        expect(container.querySelectorAll('a')).toHaveLength(1)
    })

    it('plays two localized beats with no ask and no link, so nothing focusable sits under aria-hidden', () => {
        const { container } = render(
            <UsEuRequestStrips
                linked={false}
                labels={{
                    requesting: '{username} está pedindo',
                    paid: 'Pago',
                    chatLabel: 'Chat: {main} envia um link de cobrança Peanut de {amount}; {payer} pagou',
                }}
            />
        )
        expect(screen.getByRole('img')).toHaveAccessibleName(
            'Chat: Fulano envia um link de cobrança Peanut de $250; Mengano pagou'
        )
        expect(container.querySelectorAll('[data-story-beat]')).toHaveLength(2)
        expect(screen.getByText('fulano está pedindo')).toBeInTheDocument()
        expect(screen.getByText('Pago')).toBeInTheDocument()
        expect(screen.queryByText('Where do I pay you?')).toBeNull()
        expect(container.querySelector('[aria-hidden]')!.querySelectorAll(FOCUSABLE)).toHaveLength(0)
        expect(container.querySelector('a')).toBeNull()
    })
})
