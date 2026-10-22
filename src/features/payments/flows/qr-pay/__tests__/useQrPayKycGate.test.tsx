import { act, renderHook } from '@testing-library/react'
import { useQrPayKycGate } from '../useQrPayKycGate'

// The QR pay page's one verification step. An approved user whose identity
// evidence is missing gets the identity restart, because the start route
// answers "already approved" for them and opens nothing (TASK-22698). Every
// other user gets the QR start. A failed start is a toast.

const mockFlow = {
    handleInitiateKyc: jest.fn(),
    handleRestartIdentity: jest.fn(),
    completeFlow: jest.fn(),
    showWrapper: false,
    isModalOpen: false,
    error: null as string | null,
}
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({ useMultiPhaseKycFlow: () => mockFlow }))
const mockToastError = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1' } }, fetchUser: jest.fn() }),
}))
let mockNextActions: unknown[] = []
let mockIsKycApproved = true
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        canDo: () => true,
        railsForProvider: () => [],
        nextActions: mockNextActions,
        isKycApproved: mockIsKycApproved,
        isLoading: false,
    }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: false, isTerminalFailure: false }),
}))

beforeEach(() => {
    jest.clearAllMocks()
    mockNextActions = []
    mockIsKycApproved = true
    mockFlow.error = null
})

describe('useQrPayKycGate — startVerification', () => {
    it('starts the QR check for the scanned country', () => {
        const { result } = renderHook(() => useQrPayKycGate())
        act(() => result.current.startVerification('BR'))
        expect(mockFlow.handleInitiateKyc).toHaveBeenCalledWith('LATAM', undefined, true, 'BR')
        expect(mockFlow.handleRestartIdentity).not.toHaveBeenCalled()
    })

    it('restarts the identity check for an approval with missing identity evidence', () => {
        mockNextActions = [{ key: 'restart-identity', kind: 'restart-identity', purpose: 'identity_missing' }]
        const { result } = renderHook(() => useQrPayKycGate())
        expect(result.current.needsIdentityRestart).toBe(true)
        act(() => result.current.startVerification('BR'))
        expect(mockFlow.handleRestartIdentity).toHaveBeenCalledTimes(1)
        expect(mockFlow.handleInitiateKyc).not.toHaveBeenCalled()
    })

    it('a failed start is a toast, not a tap that does nothing', () => {
        const { rerender } = renderHook(() => useQrPayKycGate())
        mockFlow.error = 'Could not restart verification. Please try again.'
        rerender()
        expect(mockToastError).toHaveBeenCalledWith('Could not restart verification. Please try again.')
    })
})
