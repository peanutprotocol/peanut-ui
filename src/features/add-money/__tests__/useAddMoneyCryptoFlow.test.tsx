/**
 * @jest-environment jsdom
 */
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
}))

let mockQueryValues: Record<string, string | null> = {}
jest.mock('nuqs', () => ({
    useQueryState: (key: string) => [mockQueryValues[key] ?? null, jest.fn()],
    parseAsString: {},
    parseAsStringEnum: () => ({}),
}))

let mockUser: any = null
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser }),
}))

jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ address: undefined }),
}))

const mockSafeBack = jest.fn()
jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: () => mockSafeBack,
}))

jest.mock('@/services/rhino', () => ({
    rhinoApi: { createDepositAddress: jest.fn() },
}))

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: any[]) => mockCapture(...args) },
}))

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
}))

jest.mock('@/utils/general.utils', () => ({
    getExplorerUrl: jest.fn(() => 'https://arbiscan.io'),
    sanitizeRedirectURL: jest.fn((url: string) =>
        url.startsWith('/') && !url.startsWith('//') && !url.includes('://') ? url : null
    ),
}))

jest.mock('@/constants/rhino.consts', () => ({
    NETWORK_LABELS: { EVM: 'EVM', SOL: 'Solana', TRON: 'Tron' },
    CHAIN_LOGOS: { ETHEREUM: '/eth.png' },
    TOKEN_LOGOS: { USDT: '/usdt.png' },
}))

jest.mock('@/hooks/useTransactionHistory', () => ({
    EHistoryUserRole: { RECIPIENT: 'RECIPIENT' },
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: { DEPOSIT_COMPLETED: 'deposit_completed' },
}))

import { useAddMoneyCryptoFlow } from '../useAddMoneyCryptoFlow'

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
    </QueryClientProvider>
)

describe('useAddMoneyCryptoFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockQueryValues = {}
        mockUser = null
    })

    it('needs a network choice on a bare url, defaults the network to EVM', () => {
        const { result } = renderHook(() => useAddMoneyCryptoFlow(), { wrapper })
        expect(result.current.needsNetworkChoice).toBe(true)
        expect(result.current.network).toBe('EVM')
    })

    it('a ?network deep link skips the network choice', () => {
        mockQueryValues.network = 'SOL'
        const { result } = renderHook(() => useAddMoneyCryptoFlow(), { wrapper })
        expect(result.current.needsNetworkChoice).toBe(false)
        expect(result.current.network).toBe('SOL')
    })

    it('back pushes a same-origin returnTo instead of history-back', () => {
        mockQueryValues.returnTo = '/profile/exchange-rate'
        const { result } = renderHook(() => useAddMoneyCryptoFlow(), { wrapper })
        act(() => result.current.onBack())
        expect(mockRouterPush).toHaveBeenCalledWith('/profile/exchange-rate')
        expect(mockSafeBack).not.toHaveBeenCalled()
    })

    it('an off-origin returnTo falls through to safe back', () => {
        mockQueryValues.returnTo = 'https://evil.example/phish'
        const { result } = renderHook(() => useAddMoneyCryptoFlow(), { wrapper })
        act(() => result.current.onBack())
        expect(mockSafeBack).toHaveBeenCalled()
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('handleSuccess records the deposit and flips to the success view', () => {
        mockUser = { user: { userId: 'u1' }, invitedBy: 'someone' }
        const { result } = renderHook(() => useAddMoneyCryptoFlow(), { wrapper })

        act(() => result.current.handleSuccess(50))

        expect(mockCapture).toHaveBeenCalledWith('deposit_completed', {
            amount: 50,
            chain_type: 'EVM',
            method_type: 'crypto',
            acquisition_source: 'referred',
        })
        expect(result.current.showSuccessView).toBe(true)
        expect(result.current.depositResult).toEqual({ status: 'completed', amount: 50 })
        // receipt details derive from the deposit result
        expect(result.current.depositTransactionDetails?.amount).toBe(50)
        expect(result.current.depositTransactionDetails?.tokenSymbol).toBe('USDT')
    })

    it('handleSuccessComplete clears the success state', () => {
        const { result } = renderHook(() => useAddMoneyCryptoFlow(), { wrapper })
        act(() => result.current.handleSuccess(10))
        act(() => result.current.handleSuccessComplete())
        expect(result.current.showSuccessView).toBe(false)
        expect(result.current.depositResult).toBeNull()
        expect(result.current.depositTransactionDetails).toBeNull()
    })
})
