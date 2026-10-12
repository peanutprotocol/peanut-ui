import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { KycActionRequired } from '../KycActionRequired'

// Integration-level companion to KycStates.test.tsx: that suite mocks
// RejectLabelsList to assert branch selection. Here we render the REAL
// RejectLabelsList + reject-label copy map so a regression in the
// DUPLICATE_EMAIL → "Email already in use" mapping (the whole point of the
// precedence fix) actually fails a test instead of shipping silently.

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

jest.mock('use-haptic', () => ({
    useHaptic: () => ({ triggerHaptic: jest.fn() }),
}))

jest.mock('@/hooks/useLongPress', () => ({
    useLongPress: () => ({ isLongPressed: false, pressProgress: 0, handlers: {} }),
}))

jest.mock('../../KYCStatusDrawerItem', () => ({
    KYCStatusDrawerItem: () => <div data-testid="kyc-status-drawer-item" />,
}))

describe('KycActionRequired — real reject-label copy', () => {
    it('renders the DUPLICATE_EMAIL guidance, not the generic resubmit message', () => {
        render(
            <KycActionRequired
                onResume={jest.fn()}
                actionMessage="We need a bit more to verify your identity. Please resubmit your documents."
                rejectLabels={['DUPLICATE_EMAIL']}
            />
        )

        expect(screen.getByText(/already linked to another Peanut account/i)).toBeInTheDocument()
        expect(screen.getByText(/sign in to that account/i)).toBeInTheDocument()
        expect(screen.queryByText(/resubmit your documents/i)).not.toBeInTheDocument()
    })
})

describe('KycActionRequired — an email collision', () => {
    const renderCollision = () => {
        const handlers = { onResume: jest.fn(), onContactSupport: jest.fn(), onLogOut: jest.fn() }
        render(
            <KycActionRequired
                {...handlers}
                actionMessage="We need a bit more to verify your identity. Please resubmit your documents."
                rejectLabels={['DUPLICATE_EMAIL']}
                isEmailCollision
            />
        )
        return handlers
    }

    it('offers the ways out its copy names, never "Resubmit"', () => {
        renderCollision()
        expect(screen.getByText(/already linked to another Peanut account/i)).toBeInTheDocument()
        expect(screen.queryByText(/re-submit verification/i)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Contact support' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
    })

    it('Contact support and Log out do what they say, and nothing starts a new ID check', () => {
        const handlers = renderCollision()
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
        expect(handlers.onContactSupport).toHaveBeenCalled()
        expect(handlers.onLogOut).toHaveBeenCalled()
        expect(handlers.onResume).not.toHaveBeenCalled()
    })

    it('any other action_required keeps Resubmit', () => {
        render(<KycActionRequired onResume={jest.fn()} rejectLabels={['BAD_PROOF_OF_IDENTITY']} />)
        expect(screen.getByRole('button', { name: /re-submit verification/i })).toBeInTheDocument()
    })
})
