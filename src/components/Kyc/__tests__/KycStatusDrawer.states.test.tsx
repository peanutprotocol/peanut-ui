import { render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { KycStatusDrawer } from '../KycStatusDrawer'
import type { UseIdentityVerificationResult } from '@/hooks/useIdentityVerification'

// Which state the identity drawer shows. A FINAL rejection the API stores as
// action_required is a decision: the failed view with support, never
// "Resubmit". An email collision gets its own way out.

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

let mockIdentity: Partial<UseIdentityVerificationResult>
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => mockIdentity,
}))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({ handleInitiateKyc: jest.fn(), isLoading: false, error: null }),
}))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ logoutUser: jest.fn() }) }))
jest.mock('../KYCStatusDrawerItem', () => ({
    KYCStatusDrawerItem: ({ status }: { status: string }) => <div data-testid={`status-${status}`} />,
}))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/hooks/useLongPress', () => ({
    useLongPress: () => ({ isLongPressed: false, pressProgress: 0, handlers: {} }),
}))

const actionRequired = (overrides: Partial<UseIdentityVerificationResult>) => {
    mockIdentity = {
        status: 'action_required',
        identity: { status: 'action_required', rejectLabels: ['FORGERY'] },
        isRegionRestricted: false,
        isTerminalFailure: false,
        isEmailCollision: false,
        ...overrides,
    }
    render(<KycStatusDrawer isOpen onClose={jest.fn()} />)
}

describe('KycStatusDrawer — action_required', () => {
    it('a FINAL rejection shows the failed view with support, not "Resubmit"', () => {
        actionRequired({ isTerminalFailure: true })
        expect(screen.getByTestId('status-failed')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Contact support' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /re-submit|retry/i })).not.toBeInTheDocument()
    })

    it('an email collision shows its way out, not "Resubmit"', () => {
        actionRequired({
            identity: { status: 'action_required', rejectLabels: ['DUPLICATE_EMAIL'] },
            isEmailCollision: true,
        })
        expect(screen.getByRole('button', { name: 'Contact support' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /re-submit/i })).not.toBeInTheDocument()
    })

    it('a retryable rejection keeps Resubmit', () => {
        actionRequired({ identity: { status: 'action_required', rejectLabels: ['BAD_PROOF_OF_IDENTITY'] } })
        expect(screen.getByRole('button', { name: /re-submit verification/i })).toBeInTheDocument()
    })
})

describe('KycStatusDrawer — processing', () => {
    it('drops the submitted date when the API has no real one', () => {
        mockIdentity = {
            status: 'processing',
            identity: { status: 'processing' },
            isRegionRestricted: false,
            isTerminalFailure: false,
            isEmailCollision: false,
        }
        render(<KycStatusDrawer isOpen onClose={jest.fn()} />)
        expect(screen.queryByText(/not available/i)).not.toBeInTheDocument()
        expect(screen.queryByText('Submitted')).not.toBeInTheDocument()
    })
})
