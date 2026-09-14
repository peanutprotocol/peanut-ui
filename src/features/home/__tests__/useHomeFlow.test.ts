/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react'
import { useHomeFlow } from '../useHomeFlow'

const mockFetchUser = jest.fn()
const mockResetClaimBankFlow = jest.fn()
const mockDisconnect = jest.fn()

let mockUser: any = null
let mockIsFetchingUser = false
let mockWagmiConnected = false

jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ spendableBalance: 123n, isFetchingSpendableBalance: false }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser, isFetchingUser: mockIsFetchingUser, fetchUser: mockFetchUser }),
}))
jest.mock('@/hooks/useActivationStatus', () => ({
    useActivationStatus: () => ({ isActivated: true, activationStep: 'verify', dismissCardStep: jest.fn() }),
}))
jest.mock('@/context/ClaimBankFlowContext', () => ({
    useClaimBankFlow: () => ({ resetFlow: mockResetClaimBankFlow }),
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

    it('hands down the username, never the display name', () => {
        mockUser = userWith({ showFullName: true, fullName: 'Kushagra S' })
        const flow = renderHook(() => useHomeFlow()).result.current
        expect(flow.username).toBe('kush')
        expect(flow).not.toHaveProperty('avatarName')
    })

    it('carries no avatar any more — home wears a menu button (TASK-22142)', () => {
        mockUser = userWith({ avatarKey: 'basic.frog' })
        expect(renderHook(() => useHomeFlow()).result.current).not.toHaveProperty('avatarKey')
    })
})
