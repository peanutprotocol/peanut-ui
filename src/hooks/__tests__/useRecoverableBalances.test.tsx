/**
 * Pins the recover-funds balance-discovery failure semantics (TASK-21829).
 *
 * The branch under test decides whether a user is told they have funds to
 * recover, so the two lies it must never tell are pinned here:
 * - a failed portfolio fetch must surface the retryable error state, not an
 *   infinite loader (the pre-fix behavior);
 * - a failed Linea read with an otherwise-empty portfolio must surface the
 *   error state, not "no tokens to recover" (Linea USDC exists ONLY via that
 *   read — Mobula never returns Linea).
 */
import { renderHook, waitFor, act } from '@testing-library/react'
import { useRecoverableBalances, USDC_IN_LINEA } from '@/hooks/useRecoverableBalances'
import { fetchWalletBalances } from '@/services/tokens-price'
import { PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'

jest.mock('@/services/tokens-price', () => ({ fetchWalletBalances: jest.fn() }))

const mockReadContract = jest.fn()
jest.mock('@/app/actions/clients', () => ({
    getPublicClient: () => ({ readContract: mockReadContract }),
}))

const mockCaptureException = jest.fn()
jest.mock('@sentry/nextjs', () => ({ captureException: (...args: unknown[]) => mockCaptureException(...args) }))

const mockFetchWalletBalances = fetchWalletBalances as jest.MockedFunction<typeof fetchWalletBalances>

const ARB_TOKEN = {
    chainId: '42161',
    address: '0x1111111111111111111111111111111111111111',
    name: 'Some Token',
    symbol: 'TOK',
    decimals: 18,
    price: 2,
    amount: 5,
    currency: 'usd',
    logoURI: 'https://example.test/tok.png',
    value: '10',
}

describe('useRecoverableBalances', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockReadContract.mockResolvedValue(0n)
    })

    it('surfaces the error state (not an infinite loader) when the portfolio fetch fails', async () => {
        mockFetchWalletBalances.mockRejectedValue(new Error('portfolio unavailable'))
        const { result } = renderHook(() => useRecoverableBalances('0xabc'))
        await waitFor(() => expect(result.current.fetchingBalances).toBe(false))
        expect(result.current.balancesError).toBe(true)
        expect(mockCaptureException).toHaveBeenCalled()
    })

    it('surfaces the error state when the Linea read fails and nothing else is recoverable', async () => {
        mockFetchWalletBalances.mockResolvedValue({ balances: [], totalBalance: 0 })
        mockReadContract.mockRejectedValue(new Error('linea rpc down'))
        const { result } = renderHook(() => useRecoverableBalances('0xabc'))
        await waitFor(() => expect(result.current.fetchingBalances).toBe(false))
        expect(result.current.balancesError).toBe(true)
        expect(result.current.tokenBalances).toHaveLength(0)
    })

    it('keeps the token list (minus the Linea row) when the Linea read fails but other tokens exist', async () => {
        mockFetchWalletBalances.mockResolvedValue({ balances: [ARB_TOKEN], totalBalance: 10 })
        mockReadContract.mockRejectedValue(new Error('linea rpc down'))
        const { result } = renderHook(() => useRecoverableBalances('0xabc'))
        await waitFor(() => expect(result.current.fetchingBalances).toBe(false))
        expect(result.current.balancesError).toBe(false)
        expect(result.current.tokenBalances).toHaveLength(1)
        expect(result.current.tokenBalances[0].symbol).toBe('TOK')
        expect(mockCaptureException).toHaveBeenCalled()
    })

    it('appends the Linea USDC row when the read returns a balance', async () => {
        mockFetchWalletBalances.mockResolvedValue({ balances: [], totalBalance: 0 })
        mockReadContract.mockResolvedValue(2_500_000n) // 2.5 USDC
        const { result } = renderHook(() => useRecoverableBalances('0xabc'))
        await waitFor(() => expect(result.current.fetchingBalances).toBe(false))
        expect(result.current.balancesError).toBe(false)
        expect(result.current.tokenBalances).toHaveLength(1)
        expect(result.current.tokenBalances[0]).toMatchObject({ address: USDC_IN_LINEA, symbol: 'USDC', amount: 2.5 })
    })

    it('filters out the Peanut wallet token and non-recoverable chains', async () => {
        mockFetchWalletBalances.mockResolvedValue({
            balances: [
                ARB_TOKEN,
                { ...ARB_TOKEN, address: PEANUT_WALLET_TOKEN }, // the wallet's own USDC — not recoverable
                { ...ARB_TOKEN, chainId: '137', address: '0x2222222222222222222222222222222222222222' }, // Polygon — not a recovery chain
            ],
            totalBalance: 30,
        })
        const { result } = renderHook(() => useRecoverableBalances('0xabc'))
        await waitFor(() => expect(result.current.fetchingBalances).toBe(false))
        expect(result.current.tokenBalances).toHaveLength(1)
        expect(result.current.tokenBalances[0].address).toBe(ARB_TOKEN.address)
    })

    it('retry refetches after a failure', async () => {
        mockFetchWalletBalances.mockRejectedValueOnce(new Error('down'))
        const { result } = renderHook(() => useRecoverableBalances('0xabc'))
        await waitFor(() => expect(result.current.balancesError).toBe(true))

        mockFetchWalletBalances.mockResolvedValue({ balances: [ARB_TOKEN], totalBalance: 10 })
        act(() => result.current.retry())
        await waitFor(() => expect(result.current.tokenBalances).toHaveLength(1))
        expect(result.current.balancesError).toBe(false)
    })

    it('does nothing until the wallet address resolves', () => {
        const { result } = renderHook(() => useRecoverableBalances(undefined))
        expect(mockFetchWalletBalances).not.toHaveBeenCalled()
        expect(result.current.fetchingBalances).toBe(true) // the page keeps its loader
    })
})
