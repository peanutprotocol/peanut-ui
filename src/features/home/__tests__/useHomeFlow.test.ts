/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react'
import { useHomeFlow } from '../useHomeFlow'

const mockFetchUser = jest.fn()
const mockResetClaimBankFlow = jest.fn()
const mockResetWithdrawFlow = jest.fn()
const mockDisconnect = jest.fn()

let mockUser: any = null
let mockIsFetchingUser = false
let mockWagmiConnected = false

let mockOverview: unknown = undefined
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ spendableBalance: 123n, isFetchingSpendableBalance: false, balance: 2_840_000n }),
}))
jest.mock('@/redux/hooks', () => ({
    useUserStore: () => ({ user: mockUser }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ isFetchingUser: mockIsFetchingUser, fetchUser: mockFetchUser }),
}))
jest.mock('@/hooks/useActivationStatus', () => ({
    useActivationStatus: () => ({ isActivated: true, activationStep: 'verify', dismissCardStep: jest.fn() }),
}))
jest.mock('@/context/ClaimBankFlowContext', () => ({
    useClaimBankFlow: () => ({ resetFlow: mockResetClaimBankFlow }),
}))
jest.mock('@/context/WithdrawFlowContext', () => ({
    useWithdrawFlow: () => ({ resetWithdrawFlow: mockResetWithdrawFlow }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: mockOverview }),
}))
jest.mock('@/hooks/useCardInfo', () => ({
    useCardInfo: jest.fn(() => ({})),
}))
jest.mock('wagmi', () => ({
    useAccount: () => ({ isConnected: mockWagmiConnected }),
    useDisconnect: () => ({ disconnect: mockDisconnect }),
}))
jest.mock('../useBalanceVisibility', () => ({
    useBalanceVisibility: () => ({ isBalanceHidden: false, toggleBalanceVisibility: jest.fn() }),
}))

const userWith = (u: object) => ({ user: { userId: 'u1', username: 'kush', ...u } })

describe('useHomeFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockUser = null
        mockIsFetchingUser = false
        mockWagmiConnected = false
        mockOverview = undefined
    })

    it('gates the page on first user fetch only', () => {
        mockIsFetchingUser = true
        const { result } = renderHook(() => useHomeFlow())
        expect(result.current.isPageLoading).toBe(true)
    })

    it('does not gate when the username is already known', () => {
        mockIsFetchingUser = true
        mockUser = userWith({})
        const { result } = renderHook(() => useHomeFlow())
        expect(result.current.isPageLoading).toBe(false)
    })

    it('re-fetches the user and resets money flows on mount', () => {
        renderHook(() => useHomeFlow())
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        expect(mockResetClaimBankFlow).toHaveBeenCalled()
        expect(mockResetWithdrawFlow).toHaveBeenCalled()
    })

    it('disconnects an external wallet on home', () => {
        mockWagmiConnected = true
        renderHook(() => useHomeFlow())
        expect(mockDisconnect).toHaveBeenCalled()
    })

    it('leaves the external wallet alone when not connected', () => {
        renderHook(() => useHomeFlow())
        expect(mockDisconnect).not.toHaveBeenCalled()
    })

    it('never derives an avatar name from the display name — the chip seeds from the username', () => {
        mockUser = userWith({ showFullName: true, fullName: 'Kushagra S' })
        const flow = renderHook(() => useHomeFlow()).result.current
        expect(flow.username).toBe('kush')
        expect(flow).not.toHaveProperty('avatarName')
    })

    it('passes the picked avatar through, null when there is none', () => {
        mockUser = userWith({ avatarKey: 'basic.frog' })
        expect(renderHook(() => useHomeFlow()).result.current.avatarKey).toBe('basic.frog')

        mockUser = userWith({})
        expect(renderHook(() => useHomeFlow()).result.current.avatarKey).toBeNull()
    })

    it('hides the on card / off card line until the user has an active card and both halves are known', () => {
        mockUser = userWith({})
        const { result } = renderHook(() => useHomeFlow())
        expect(result.current.balanceSplit).toBeNull()
    })

    it('splits the total into on card and off card for a card holder', () => {
        mockUser = userWith({})
        mockOverview = {
            status: { hasApplication: true },
            balanceUnavailable: false,
            balance: {
                creditLimit: 0,
                pendingCharges: 0,
                postedCharges: 0,
                balanceDue: 0,
                spendingPower: 10_000,
                inTransitToCollateralCents: 250,
            },
            cards: [{ id: 'c1', status: 'ACTIVE', hasWithdrawApproval: true }],
        }
        const { result } = renderHook(() => useHomeFlow())
        // $102.50 on card (landed + in transit), $2.84 off card (smart wallet)
        expect(result.current.balanceSplit).toEqual({ onCardCents: 10_250, offCardCents: 284 })
    })
})
