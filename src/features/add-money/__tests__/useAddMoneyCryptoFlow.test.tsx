/**
 * @jest-environment jsdom
 */
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
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

const wrapperFor = (search = '') => {
    const NuqsWrapper = withNuqsTestingAdapter({ searchParams: search })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>
            <NuqsWrapper>{children}</NuqsWrapper>
        </QueryClientProvider>
    )
    return Wrapper
}

const renderFlow = (search = '') => renderHook(() => useAddMoneyCryptoFlow(), { wrapper: wrapperFor(search) })

describe('useAddMoneyCryptoFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockUser = null
    })

    it('needs a network choice on a bare url, defaults the network to EVM', () => {
        const { result } = renderFlow()
        expect(result.current.needsNetworkChoice).toBe(true)
        expect(result.current.network).toBe('EVM')
    })

    it('a ?network deep link skips the network choice', () => {
        const { result } = renderFlow('?network=SOL')
        expect(result.current.needsNetworkChoice).toBe(false)
        expect(result.current.network).toBe('SOL')
    })

    it('back pushes a same-origin returnTo instead of history-back', () => {
        const { result } = renderFlow(`?returnTo=${encodeURIComponent('/profile/exchange-rate')}`)
        act(() => result.current.onBack())
        expect(mockRouterPush).toHaveBeenCalledWith('/profile/exchange-rate')
        expect(mockSafeBack).not.toHaveBeenCalled()
    })

    it('an off-origin returnTo falls through to safe back', () => {
        const { result } = renderFlow(`?returnTo=${encodeURIComponent('https://evil.example/phish')}`)
        act(() => result.current.onBack())
        expect(mockSafeBack).toHaveBeenCalled()
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('handleSuccess records the deposit and flips to the success view', () => {
        mockUser = { user: { userId: 'u1' }, invitedBy: 'someone' }
        const { result } = renderFlow()

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

    // GET /history/:id resolves a crypto deposit by the `tx:` prefixed EVM hash
    // and by nothing else, so a bare hash 404s and the receipt cannot be shared.
    it('keys the receipt on the prefixed transaction hash', () => {
        const { result } = renderFlow()

        act(() =>
            result.current.handleSuccess(50, {
                status: 'completed',
                amount: 50,
                txHash: '0xAB'.padEnd(66, 'c'),
            } as never)
        )

        expect(result.current.depositTransactionDetails?.id).toBe(`tx:${'0xab'.padEnd(66, 'c')}`)
        // the on-chain hash itself is unchanged: it is what the receipt prints
        expect(result.current.depositTransactionDetails?.txHash).toBe('0xAB'.padEnd(66, 'c'))
    })

    // Only an EVM hash has a `tx:` form. A Solana hash is base58 and
    // case-sensitive, so lowercasing it would corrupt it, and a Tron hash has
    // no `0x` at all. Neither is rewritten, and neither is offered a document.
    it.each([
        ['solana', '5Tx9AbCdEfGhJkLmNpQrStUvWxYz1234567890AbCdEfGhJkLmNpQrStUvWxYz'],
        ['tron', 'TXYZa1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0'],
    ])('leaves a %s hash exactly as the chain wrote it', (_network, hash) => {
        const { result } = renderFlow()

        act(() => result.current.handleSuccess(50, { status: 'completed', amount: 50, txHash: hash } as never))

        expect(result.current.depositTransactionDetails?.id).toBe(hash)
        expect(result.current.depositTransactionDetails?.txHash).toBe(hash)
    })

    it('falls back to a plain key when the deposit carries no hash', () => {
        const { result } = renderFlow()

        act(() => result.current.handleSuccess(50))

        expect(result.current.depositTransactionDetails?.id).toBe('deposit')
    })

    it('handleSuccessComplete clears the success state', () => {
        const { result } = renderFlow()
        act(() => result.current.handleSuccess(10))
        act(() => result.current.handleSuccessComplete())
        expect(result.current.showSuccessView).toBe(false)
        expect(result.current.depositResult).toBeNull()
        expect(result.current.depositTransactionDetails).toBeNull()
    })
})
