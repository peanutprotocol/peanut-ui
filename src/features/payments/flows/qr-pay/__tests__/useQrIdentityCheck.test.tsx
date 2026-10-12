import { act, renderHook } from '@testing-library/react'
import { useQrIdentityCheck } from '../useQrIdentityCheck'

// The QR ID check started from Home. An approval enables only the pay-only QR
// rails, which the flow's bank finish line never counts, so the hook closes
// the flow once the QR-pay gate opens. A failed start is a toast.

const mockFlow = {
    handleInitiateKyc: jest.fn(),
    completeFlow: jest.fn(),
    showWrapper: false,
    isModalOpen: false,
    error: null as string | null,
}
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({ useMultiPhaseKycFlow: () => mockFlow }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
const mockToastError = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))
let mockCanPay = false
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        canDo: () => mockCanPay,
        railsForProvider: () => [],
        nextActions: [],
        isLoading: false,
    }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: false, isTerminalFailure: false }),
}))

beforeEach(() => {
    jest.clearAllMocks()
    mockCanPay = false
    Object.assign(mockFlow, { showWrapper: false, isModalOpen: false, error: null })
})

describe('useQrIdentityCheck', () => {
    it('starts the verification QR pay starts', () => {
        const { result } = renderHook(() => useQrIdentityCheck())
        act(() => result.current.start())
        expect(mockFlow.handleInitiateKyc).toHaveBeenCalledWith('LATAM')
    })

    it('closes the flow once QR pay opens, instead of waiting for a bank rail', () => {
        const { result, rerender } = renderHook(() => useQrIdentityCheck())
        act(() => result.current.start())
        mockFlow.isModalOpen = true
        rerender()
        expect(mockFlow.completeFlow).not.toHaveBeenCalled()
        mockCanPay = true
        rerender()
        expect(mockFlow.completeFlow).toHaveBeenCalledTimes(1)
    })

    it('never closes a flow it did not start', () => {
        mockCanPay = true
        mockFlow.isModalOpen = true
        renderHook(() => useQrIdentityCheck())
        expect(mockFlow.completeFlow).not.toHaveBeenCalled()
    })

    it('a failed start is a toast, not a tap that does nothing', () => {
        const { rerender } = renderHook(() => useQrIdentityCheck())
        mockFlow.error = 'Could not initiate verification. Please try again.'
        rerender()
        expect(mockToastError).toHaveBeenCalledWith('Could not initiate verification. Please try again.')
    })
})
