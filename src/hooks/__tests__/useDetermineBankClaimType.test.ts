import { renderHook, waitFor } from '@testing-library/react'
import { BankClaimType, useDetermineBankClaimType } from '../useDetermineBankClaimType'

const mockGetUserById = jest.fn()
jest.mock('@/app/actions/users', () => ({ getUserById: (...args: unknown[]) => mockGetUserById(...args) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
const mockSetSenderDetails = jest.fn()
jest.mock('@/context/ClaimBankFlowContext', () => ({
    useClaimBankFlow: () => ({ setSenderDetails: mockSetSenderDetails }),
}))
jest.mock('../useCapabilities', () => ({ useCapabilities: () => ({ isKycApproved: false }) }))

// TASK-22936: the guest bank claim runs only while the API reports its server
// switch on. Off, a guest gets the sign-up path to claim to a bank.
describe('useDetermineBankClaimType — guest bank claim switch', () => {
    beforeEach(() => jest.clearAllMocks())

    it.each([
        ['on', true, BankClaimType.GuestBankClaim],
        ['off', false, BankClaimType.GuestKycNeeded],
        ['missing (older API)', undefined, BankClaimType.GuestKycNeeded],
    ])('switch %s → %s', async (_label, guestBankClaimEnabled, expected) => {
        mockGetUserById.mockResolvedValue({ userId: 'sender', canReceiveBankOfframp: true, guestBankClaimEnabled })
        const { result } = renderHook(() => useDetermineBankClaimType('sender'))
        await waitFor(() => expect(mockGetUserById).toHaveBeenCalled())
        await waitFor(() => expect(result.current.claimType).toBe(expected))
        // the sender can still receive, so the prompt says "create an account", not "sender unverified"
        expect(result.current.senderCanReceiveBankOfframp).toBe(true)
    })
})
