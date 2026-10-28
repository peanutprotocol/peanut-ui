import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { KycStatusDrawer } from '../KycStatusDrawer'
import type { UseIdentityVerificationResult } from '@/hooks/useIdentityVerification'
import { findKycSetup } from '@/app/actions/kyc-workflow'

// The way back to the setup status: a returning user whose identity was
// verified through a verification attempt opens the identity status and gets the
// verification timeline (Smart Paperwork Verification) or the setup status
// instead, with no drawer in between. Every other identity keeps the status drawer.

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
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
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

describe('KycStatusDrawer — the setup status of a verification-attempt identity', () => {
    it.each(['verified', 'processing'] as const)('a %s identity hands over to the setup status', async (status) => {
        identity(status)
        mockFind.mockResolvedValue({ features, refusals })
        const { onClose, onKeepMounted } = open()
        await waitFor(() => expect(mockOpenSetupStatus).toHaveBeenCalledWith(features, refusals))
        expect(onKeepMounted).toHaveBeenCalledWith(true)
        expect(onClose).toHaveBeenCalled()
    })

    it.each(['verified', 'processing'] as const)(
        'a %s Smart Paperwork Verification identity opens the verification timeline, never a drawer',
        async (status) => {
            identity(status)
            mockFind.mockResolvedValue({ features, refusals, flow: 'verify-once' })
            const { onClose } = open()
            expect(screen.queryByTestId(`status-${status === 'verified' ? 'completed' : 'processing'}`)).toBeNull()
            await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/verify'))
            expect(onClose).toHaveBeenCalled()
            expect(mockOpenSetupStatus).not.toHaveBeenCalled()
        }
    )

    it('every other identity keeps the status drawer', async () => {
        identity('verified')
        mockFind.mockResolvedValue(null)
        const { onClose } = open()
        expect(await screen.findByTestId('status-completed')).toBeInTheDocument()
        expect(mockOpenSetupStatus).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
    })

    it('an identity that needs action keeps its own fix and is not checked', () => {
        identity('action_required')
        open()
        expect(mockFind).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: /re-submit verification/i })).toBeInTheDocument()
    })
})
