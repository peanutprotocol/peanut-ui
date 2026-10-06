import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
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
const mockInitiateKyc = jest.fn()
const mockRestartIdentity = jest.fn()
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: mockInitiateKyc,
        handleRestartIdentity: mockRestartIdentity,
        isLoading: false,
        error: null,
    }),
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

// api#1776: an approval with no identity document on file reads action_required.
// The start route answers "already approved" for it and opens nothing, so the
// button must restart the identity check.
describe('KycStatusDrawer — the button follows the API', () => {
    const awaitingDocument = {
        status: 'action_required' as const,
        actionMessage: 'We need an identity document and a selfie to complete your verification.',
    }

    beforeEach(() => {
        mockInitiateKyc.mockClear()
        mockRestartIdentity.mockClear()
    })

    it('restarts the identity check when the approval has no identity document', () => {
        actionRequired({ identity: awaitingDocument, needsDocumentRestart: true })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockRestartIdentity).toHaveBeenCalledWith()
        expect(mockInitiateKyc).not.toHaveBeenCalled()
    })

    it('starts the identity check as before for every other user', () => {
        actionRequired({ identity: awaitingDocument, needsDocumentRestart: false })
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockInitiateKyc).toHaveBeenCalledWith()
        expect(mockRestartIdentity).not.toHaveBeenCalled()
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
