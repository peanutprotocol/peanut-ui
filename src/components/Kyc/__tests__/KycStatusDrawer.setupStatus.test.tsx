import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { KycStatusDrawer } from '../KycStatusDrawer'
import type { UseIdentityVerificationResult } from '@/hooks/useIdentityVerification'
import { findKycSetup } from '@/app/actions/kyc-workflow'

// The way back to the setup status: a returning user whose identity was
// verified through the document list opens the identity status and gets the
// setup status instead. Every other identity keeps the status drawer.

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

let mockIdentity: Partial<UseIdentityVerificationResult>
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => mockIdentity,
}))
const mockOpenSetupStatus = jest.fn()
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: jest.fn(),
        handleRestartIdentity: jest.fn(),
        openSetupStatus: mockOpenSetupStatus,
        isLoading: false,
        error: null,
    }),
}))
jest.mock('@/app/actions/kyc-workflow', () => ({ findKycSetup: jest.fn() }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
    useModalsContextOptional: () => undefined,
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ logoutUser: jest.fn(), user: { user: { userId: 'user-1' } } }),
}))
jest.mock('../KYCStatusDrawerItem', () => ({
    KYCStatusDrawerItem: ({ status }: { status: string }) => <div data-testid={`status-${status}`} />,
}))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/hooks/useLongPress', () => ({
    useLongPress: () => ({ isLongPressed: false, pressProgress: 0, handlers: {} }),
}))

const features = { qr: true, local: false, bank: true, card: false }
const mockFind = findKycSetup as jest.MockedFunction<typeof findKycSetup>
const refusals = { manteca: 'local_tax_id_missing' }
const identity = (status: 'verified' | 'processing' | 'action_required') => {
    mockIdentity = {
        status,
        identity: { status },
        isRegionRestricted: false,
        isTerminalFailure: false,
        isEmailCollision: false,
    }
}
const open = () => {
    const onClose = jest.fn()
    const onKeepMounted = jest.fn()
    render(<KycStatusDrawer isOpen onClose={onClose} onKeepMounted={onKeepMounted} />)
    return { onClose, onKeepMounted }
}

beforeEach(() => jest.clearAllMocks())

describe('KycStatusDrawer — the setup status of a document-first identity', () => {
    it.each(['verified', 'processing'] as const)('a %s identity hands over to the setup status', async (status) => {
        identity(status)
        mockFind.mockResolvedValue({ features, refusals })
        const { onClose, onKeepMounted } = open()
        await waitFor(() => expect(mockOpenSetupStatus).toHaveBeenCalledWith(features, refusals))
        expect(onKeepMounted).toHaveBeenCalledWith(true)
        expect(onClose).toHaveBeenCalled()
    })

    it('every other identity keeps the status drawer', async () => {
        identity('verified')
        mockFind.mockResolvedValue(null)
        const { onClose } = open()
        await waitFor(() => expect(mockFind).toHaveBeenCalled())
        expect(mockOpenSetupStatus).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
        expect(screen.getByTestId('status-completed')).toBeInTheDocument()
    })

    it('an identity that needs action keeps its own fix and is not checked', () => {
        identity('action_required')
        open()
        expect(mockFind).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: /re-submit verification/i })).toBeInTheDocument()
    })
})
