/**
 * Tests for useSendMoney hook
 *
 * Critical test cases:
 * 1. Optimistic update with sufficient balance
 * 2. NO optimistic update when balance is insufficient (prevents underflow)
 * 3. Rollback on transaction failure
 * 4. Balance invalidation on success
 */

import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSendMoney } from '../useSendMoney'
import { parseUnits } from 'viem'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import type { ReactNode } from 'react'

// Mock dependencies
jest.mock('@/constants', () => ({
    PEANUT_WALLET_TOKEN: '0x1234567890123456789012345678901234567890',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
    PEANUT_WALLET_CHAIN: { id: 137 },
}))

jest.mock('@/constants/query.consts', () => ({
    TRANSACTIONS: 'transactions',
}))

// Import the mocked constant after mocking
import { TRANSACTIONS } from '@/constants/query.consts'

describe('useSendMoney', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
    })

    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const mockAddress = '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`

    describe('Optimistic Updates', () => {
        it('should optimistically update balance when sufficient balance exists', async () => {
            const initialBalance = parseUnits('100', PEANUT_WALLET_TOKEN_DECIMALS) // $100
            const amountToSend = '10' // $10

            // Set initial balance in query cache
            queryClient.setQueryData(['balance', mockAddress], initialBalance)

            const mockSend = jest.fn().mockResolvedValue({
                userOpHash: '0xhash123',
                receipt: null,
            })

            const { result } = renderHook(
                () =>
                    useSendMoney({
                        address: mockAddress,
                        handleSendUserOpEncoded: mockSend,
                    }),
                { wrapper }
            )

            // Trigger mutation
            const promise = result.current.mutateAsync({
                toAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
                amountInUsd: amountToSend,
            })

            // Check optimistic update happened immediately
            await waitFor(() => {
                const currentBalance = queryClient.getQueryData<bigint>(['balance', mockAddress])
                const expectedBalance = initialBalance - parseUnits(amountToSend, PEANUT_WALLET_TOKEN_DECIMALS)
                expect(currentBalance).toEqual(expectedBalance)
            })

            await promise
        })

        it('should NOT optimistically update balance when insufficient balance (prevents underflow)', async () => {
            const initialBalance = parseUnits('5', PEANUT_WALLET_TOKEN_DECIMALS) // $5
            const amountToSend = '10' // $10 (more than balance!)

            // Set initial balance in query cache
            queryClient.setQueryData(['balance', mockAddress], initialBalance)

            const mockSend = jest.fn().mockRejectedValue(new Error('Insufficient balance'))

            const { result } = renderHook(
                () =>
                    useSendMoney({
                        address: mockAddress,
                        handleSendUserOpEncoded: mockSend,
                    }),
                { wrapper }
            )

            // Trigger mutation (will fail)
            const promise = result.current.mutateAsync({
                toAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
                amountInUsd: amountToSend,
            })

            // Check balance was NOT updated optimistically
            const currentBalance = queryClient.getQueryData<bigint>(['balance', mockAddress])
            expect(currentBalance).toEqual(initialBalance) // Should remain unchanged

            await expect(promise).rejects.toThrow()
        })
    })

    describe('Rollback on Error', () => {
        it('should rollback optimistic update when transaction fails', async () => {
            const initialBalance = parseUnits('100', PEANUT_WALLET_TOKEN_DECIMALS)
            const amountToSend = '10'

            queryClient.setQueryData(['balance', mockAddress], initialBalance)

            const mockSend = jest.fn().mockRejectedValue(new Error('Transaction failed'))

            const { result } = renderHook(
                () =>
                    useSendMoney({
                        address: mockAddress,
                        handleSendUserOpEncoded: mockSend,
                    }),
                { wrapper }
            )

            try {
                await result.current.mutateAsync({
                    toAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
                    amountInUsd: amountToSend,
                })
            } catch (error) {
                // Expected to fail
            }

            // Wait for rollback
            await waitFor(() => {
                const currentBalance = queryClient.getQueryData<bigint>(['balance', mockAddress])
                expect(currentBalance).toEqual(initialBalance) // Should be rolled back
            })
        })
    })

    describe('Cache Invalidation', () => {
        it('should invalidate balance and transactions on success', async () => {
            const initialBalance = parseUnits('100', PEANUT_WALLET_TOKEN_DECIMALS)
            queryClient.setQueryData(['balance', mockAddress], initialBalance)

            const mockSend = jest.fn().mockResolvedValue({
                userOpHash: '0xhash123',
                receipt: { status: 'success' },
            })

            const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

            const { result } = renderHook(
                () =>
                    useSendMoney({
                        address: mockAddress,
                        handleSendUserOpEncoded: mockSend,
                    }),
                { wrapper }
            )

            await result.current.mutateAsync({
                toAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
                amountInUsd: '10',
            })

            // Check invalidation calls
            await waitFor(() => {
                expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['balance', mockAddress] })
                expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [TRANSACTIONS] })
            })
        })
    })

    describe('Edge Cases', () => {
        it('should handle undefined previous balance gracefully', async () => {
            // No initial balance in cache
            const mockSend = jest.fn().mockResolvedValue({
                userOpHash: '0xhash123',
                receipt: null,
            })

            const { result } = renderHook(
                () =>
                    useSendMoney({
                        address: mockAddress,
                        handleSendUserOpEncoded: mockSend,
                    }),
                { wrapper }
            )

            // Should not throw
            await expect(
                result.current.mutateAsync({
                    toAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
                    amountInUsd: '10',
                })
            ).resolves.toBeDefined()
        })

        it('should handle undefined address gracefully', async () => {
            const mockSend = jest.fn().mockResolvedValue({
                userOpHash: '0xhash123',
                receipt: null,
            })

            const { result } = renderHook(
                () =>
                    useSendMoney({
                        address: undefined, // No address
                        handleSendUserOpEncoded: mockSend,
                    }),
                { wrapper }
            )

            // onMutate should return early but mutation should still complete
            await result.current.mutateAsync({
                toAddress: '0x9999999999999999999999999999999999999999' as `0x${string}`,
                amountInUsd: '10',
            })

            // Should still call sendUserOpEncoded
            expect(mockSend).toHaveBeenCalled()
        })
    })
})
