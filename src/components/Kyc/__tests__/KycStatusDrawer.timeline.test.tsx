import { render as rtlRender, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { KycStatusDrawer } from '../KycStatusDrawer'
import type { UseIdentityVerificationResult } from '@/hooks/useIdentityVerification'
import { isPaperworkVerificationIdentity } from '@/app/actions/kyc-workflow'

// A returning user whose identity was verified through Smart Paperwork
// Verification opens the identity status and gets the verification timeline
// instead, with no drawer in between. Every other identity keeps the status drawer.

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

let mockIdentity: Partial<UseIdentityVerificationResult>
let mockOneShot: boolean | undefined
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => mockIdentity,
}))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: jest.fn(),
        handleRestartIdentity: jest.fn(),
        isLoading: false,
        error: null,
    }),
}))
jest.mock('@/app/actions/kyc-workflow', () => ({ isPaperworkVerificationIdentity: jest.fn() }))
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
    useModalsContextOptional: () => undefined,
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        logoutUser: jest.fn(),
        user: { user: { userId: 'user-1' }, identityVerification: { oneShot: mockOneShot } },
    }),
}))
jest.mock('../KYCStatusDrawerItem', () => ({
    KYCStatusDrawerItem: ({ status }: { status: string }) => <div data-testid={`status-${status}`} />,
}))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/hooks/useLongPress', () => ({
    useLongPress: () => ({ isLongPressed: false, pressProgress: 0, handlers: {} }),
}))

const mockFind = jest.mocked(isPaperworkVerificationIdentity)
const identity = (status: 'verified' | 'processing' | 'action_required' | 'failed') => {
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
    render(<KycStatusDrawer isOpen onClose={onClose} />)
    return { onClose }
}

beforeEach(() => {
    jest.clearAllMocks()
    mockOneShot = undefined
})

describe('KycStatusDrawer — the timeline of a Smart Paperwork Verification identity', () => {
    it.each(['verified', 'processing', 'action_required', 'failed'] as const)(
        'a %s Smart Paperwork Verification identity opens the verification timeline, never a drawer',
        async (status) => {
            identity(status)
            mockFind.mockResolvedValue(true)
            const { onClose } = open()
            expect(screen.queryByTestId(`status-${status === 'verified' ? 'completed' : 'processing'}`)).toBeNull()
            await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/verify'))
            expect(onClose).toHaveBeenCalled()
        }
    )

    it('every other identity keeps the status drawer', async () => {
        identity('verified')
        mockFind.mockResolvedValue(false)
        const { onClose } = open()
        expect(await screen.findByTestId('status-completed')).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
    })

    it('a known new-flow identity cannot reuse a previous legacy drawer check', async () => {
        identity('verified')
        mockFind.mockResolvedValue(false)
        const onClose = jest.fn()
        const view = render(<KycStatusDrawer isOpen onClose={onClose} />)
        await screen.findByTestId('status-completed')
        mockOneShot = true
        identity('failed')
        view.rerender(<KycStatusDrawer isOpen onClose={onClose} />)
        expect(screen.queryByTestId('status-failed')).toBeNull()
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/verify'))
    })

    it('an action-required legacy identity keeps its own fix after the timeline check', async () => {
        identity('action_required')
        mockFind.mockResolvedValue(false)
        open()
        await waitFor(() => expect(mockFind).toHaveBeenCalled())
        expect(await screen.findByRole('button', { name: /re-submit verification/i })).toBeInTheDocument()
    })
})
