/**
 * Tests for useSendMoney hook
 *
 * Critical test cases:
 * 1. Optimistic update with sufficient balance
 * 2. NO optimistic update when balance is insufficient (prevents underflow)
 * 3. Rollback on transaction failure
 * 4. Balance + rain-card-overview + transactions invalidation on success
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { parseUnits } from 'viem'
import type { ReactNode } from 'react'

// Mock dependencies before importing useSendMoney
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_TOKEN: '0x1234567890123456789012345678901234567890',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
    PEANUT_WALLET_CHAIN: { id: 137 },
}))

jest.mock('@/constants/query.consts', () => ({
    TRANSACTIONS: 'transactions',
    BALANCE_DECREASE: 'balance-decrease',
    SEND_MONEY: 'send-money',
}))

// Mock the spend-bundle primitive — the hook under test only cares that
// `spend()` is invoked, returns either resolved or rejected. No kernel
// client / passkey needed here.
const mockSpend = jest.fn()
jest.mock('../useSpendBundle', () => ({
    useSpendBundle: () => ({ spend: mockSpend }),
    InsufficientSpendableError: class extends Error {
        constructor() {
            super('Insufficient spendable balance')
            this.name = 'InsufficientSpendableError'
        }
    },
}))

// Mock the balance-source hooks the rewrite now reads from directly.
jest.mock('../useBalance', () => ({
    useBalance: () => ({ data: mockSmartBalance }),
}))

jest.mock('../../useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: mockRainOverview }),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))

// Per-test mutable state for the balance mocks above.
let mockSmartBalance: bigint | undefined
let mockRainOverview: { balance: { spendingPower: number } | null } | undefined

// eslint-disable-next-line import/first -- must come after jest.mock calls
import { useSendMoney } from '../useSendMoney'
// eslint-disable-next-line import/first
import { TRANSACTIONS } from '@/constants/query.consts'
// eslint-disable-next-line import/first
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'

describe('useSendMoney', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        mockSpend.mockReset()
        mockSmartBalance = undefined
        mockRainOverview = undefined
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
    )

    const mockAddress = '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`

    describe('Optimistic Updates', () => {
        it('should optimistically update balance when sufficient balance exists', async () => {
            const initialBalance = parseUnits('100', PEANUT_WALLET_TOKEN_DECIMALS)
            const amountToSend = '10'

            queryClient.setQueryData(['balance', mockAddress], initialBalance)
            mockSmartBalance = initialBalance
            mockSpend.mockResolvedValue({ strategy: 'smart-only', userOpHash: '0xhash123', receipt: null })

            const { result } = renderHook(() => useSendMoney({ address: mockAddress }), { wrapper })

            await act(async () => {
                await result.current.mutateAsync({
                    toAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
                    amountInUsd: amountToSend,
                })
            })

            const currentBalance = queryClient.getQueryData<bigint>(['balance', mockAddress])
            const expectedBalance = initialBalance - parseUnits(amountToSend, PEANUT_WALLET_TOKEN_DECIMALS)
            expect(currentBalance).toEqual(expectedBalance)
        })

        it('should NOT optimistically update balance when insufficient balance (prevents underflow)', async () => {
            const initialBalance = parseUnits('5', PEANUT_WALLET_TOKEN_DECIMALS)
            const amountToSend = '10'

            queryClient.setQueryData(['balance', mockAddress], initialBalance)
            mockSmartBalance = initialBalance
            mockSpend.mockRejectedValue(new Error('Insufficient balance'))

            const { result } = renderHook(() => useSendMoney({ address: mockAddress }), { wrapper })

            const promise = result.current.mutateAsync({
                toAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
                amountInUsd: amountToSend,
            })

            const currentBalance = queryClient.getQueryData<bigint>(['balance', mockAddress])
            expect(currentBalance).toEqual(initialBalance)

            await expect(promise).rejects.toThrow()
        })
    })

    describe('Rollback on Error', () => {
        it('should rollback optimistic update when transaction fails', async () => {
            const initialBalance = parseUnits('100', PEANUT_WALLET_TOKEN_DECIMALS)
            const amountToSend = '10'

            queryClient.setQueryData(['balance', mockAddress], initialBalance)
            mockSmartBalance = initialBalance
            mockSpend.mockRejectedValue(new Error('Transaction failed'))

            const { result } = renderHook(() => useSendMoney({ address: mockAddress }), { wrapper })

            try {
                await result.current.mutateAsync({
                    toAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
                    amountInUsd: amountToSend,
                })
            } catch {
                // expected
            }

            await waitFor(() => {
                const currentBalance = queryClient.getQueryData<bigint>(['balance', mockAddress])
                expect(currentBalance).toEqual(initialBalance)
            })
        })
    })

    describe('Cache Invalidation', () => {
        it('should invalidate balance, rain-card-overview and transactions on success', async () => {
            const initialBalance = parseUnits('100', PEANUT_WALLET_TOKEN_DECIMALS)
            queryClient.setQueryData(['balance', mockAddress], initialBalance)
            mockSmartBalance = initialBalance
            mockSpend.mockResolvedValue({ strategy: 'smart-only', userOpHash: '0xhash123', receipt: null })

            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

            const { result } = renderHook(() => useSendMoney({ address: mockAddress }), { wrapper })

            await result.current.mutateAsync({
                toAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
                amountInUsd: '10',
            })

            await waitFor(() => {
                expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['balance', mockAddress] })
                expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rain-card-overview'] })
                expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [TRANSACTIONS] })
            })
        })
    })

    describe('Edge Cases', () => {
        it('should handle undefined previous balance gracefully', async () => {
            mockSmartBalance = undefined
            mockSpend.mockResolvedValue({ strategy: 'smart-only', userOpHash: '0xhash123', receipt: null })

            const { result } = renderHook(() => useSendMoney({ address: mockAddress }), { wrapper })

            await expect(
                result.current.mutateAsync({
                    toAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
                    amountInUsd: '10',
                })
            ).resolves.toBeDefined()
        })

        it('should handle undefined address gracefully', async () => {
            mockSmartBalance = undefined
            mockSpend.mockResolvedValue({ strategy: 'smart-only', userOpHash: '0xhash123', receipt: null })

            const { result } = renderHook(() => useSendMoney({ address: undefined }), { wrapper })

            await result.current.mutateAsync({
                toAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
                amountInUsd: '10',
            })

            expect(mockSpend).toHaveBeenCalled()
        })
    })
})
