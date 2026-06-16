/**
 * Integration test for the recoverable-routing wiring in `useSpendBundle.spend`.
 *
 * The DECISION (when to re-route) is unit-tested in `useSpendBundle.test.ts`
 * (`rerouteAfterSmartOnlySweep`). This file renders the hook and proves the
 * WIRING around it:
 *   - a `smart-only` spend whose UserOp throws (the smart account was swept to
 *     collateral after we routed) re-reads the live balance and RETRIES on
 *     collateral — without ever broadcasting twice (no double-spend).
 *   - a `smart-only` failure that is NOT a sweep (balance still covers it)
 *     rethrows the original error and does NOT touch collateral.
 */

import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

const KERNEL_ADDRESS = '0x959e088a09f61ab01cb83b0ebcc74b2cf6d62053'
const RECIPIENT = '0x00000000000000000000000000000000000000aa'

const mockHandleSendUserOpEncoded = jest.fn()
const mockSignTypedData = jest.fn().mockResolvedValue('0xadminsig')
const mockReadContract = jest.fn()
const mockPrepareWithdrawal = jest.fn()
const mockSubmitWithdrawal = jest.fn()
const mockGrant = jest.fn()

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 137 },
    PEANUT_WALLET_TOKEN: '0x1234567890123456789012345678901234567890',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))
jest.mock('@/constants/rain.consts', () => ({
    rainCoordinatorAbi: [],
    rainWithdrawEip712Types: {},
    RAIN_WITHDRAW_EIP712_DOMAIN_NAME: 'Collateral',
    RAIN_WITHDRAW_EIP712_DOMAIN_VERSION: '2',
}))
jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: {
        CARD_WITHDRAW_ATTEMPTED: 'card_withdraw_attempted',
        CARD_WITHDRAW_SUCCEEDED: 'card_withdraw_succeeded',
        CARD_WITHDRAW_FAILED: 'card_withdraw_failed',
    },
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        getClientForChain: () => ({
            account: { address: '0x959e088a09f61ab01cb83b0ebcc74b2cf6d62053', signTypedData: mockSignTypedData },
        }),
    }),
}))
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleSendUserOpEncoded: mockHandleSendUserOpEncoded }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { accounts: [] } }) }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    // hasWithdrawApproval: true → grant pre-flight is a no-op, so the collateral
    // path runs without needing to mock the session-key grant.
    useRainCardOverview: () => ({ overview: { cards: [{ hasWithdrawApproval: true }] } }),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('../useGrantSessionKey', () => ({ useGrantSessionKey: () => ({ grant: mockGrant }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContextOptional: () => null }))
jest.mock('@/services/rain', () => ({
    rainApi: {
        prepareWithdrawal: (...args: unknown[]) => mockPrepareWithdrawal(...args),
        submitWithdrawal: (...args: unknown[]) => mockSubmitWithdrawal(...args),
        stampWithdrawal: jest.fn().mockResolvedValue(undefined),
    },
}))
jest.mock('@/utils/balance.utils', () => ({ usdcUnitsToRainCents: (x: bigint) => x }))
jest.mock('@/app/actions/clients', () => ({
    peanutPublicClient: { readContract: (...args: unknown[]) => mockReadContract(...args) },
}))

// eslint-disable-next-line import/first -- mocks must register before import
import { useSpendBundle } from '../useSpendBundle'

const wrapper = ({ children }: { children: ReactNode }) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return createElement(QueryClientProvider, { client: queryClient }, children)
}

const AMOUNT = 1_000_000n // 1 USDC (6dp)
const RAIN_POWER = 5_000_000n

const spendInput = {
    requiredUsdcAmount: AMOUNT,
    recipient: RECIPIENT as `0x${string}`,
    rainSpendingPower: RAIN_POWER,
    kind: 'P2P_SEND' as never,
}

const collateralPrep = {
    preparationId: 'prep-1',
    collateralProxy: '0x00000000000000000000000000000000000000c0',
    tokenAddress: '0x1234567890123456789012345678901234567890',
    coordinatorAddress: '0x00000000000000000000000000000000000000c1',
    adminAddress: KERNEL_ADDRESS,
    adminSalt: '0xsalt',
    adminNonce: '0',
    amount: AMOUNT.toString(),
    recipientAddress: RECIPIENT,
    directTransfer: true,
    executorSignature: '0xexec',
    executorSalt: '0xesalt',
    expiresAt: 9_999_999_999,
}

beforeEach(() => {
    mockHandleSendUserOpEncoded.mockReset()
    mockReadContract.mockReset()
    mockPrepareWithdrawal.mockReset()
    mockSubmitWithdrawal.mockReset()
    mockGrant.mockReset()
})

describe('useSpendBundle — recoverable routing on smart-only sweep', () => {
    it('retries on collateral when a smart-only UserOp reverts after a sweep, broadcasting only once', async () => {
        // Initial routing reads a balance that covers → smart-only.
        mockReadContract.mockResolvedValueOnce(5_000_000n)
        // The smart-only UserOp throws — the account was swept empty after we
        // routed. handleSendUserOpEncoded only throws when the UserOp never
        // entered the mempool, so nothing was broadcast.
        mockHandleSendUserOpEncoded.mockRejectedValueOnce(
            new Error('UserOperation reverted: ERC20: transfer amount exceeds balance')
        )
        // Reroute re-read: now empty → reroute to collateral-only.
        mockReadContract.mockResolvedValueOnce(0n)
        mockPrepareWithdrawal.mockResolvedValue(collateralPrep)
        mockSubmitWithdrawal.mockResolvedValue({ txHash: '0xdead' })

        const { result } = renderHook(() => useSpendBundle(), { wrapper })

        let res: Awaited<ReturnType<typeof result.current.spend>> | undefined
        await act(async () => {
            res = await result.current.spend(spendInput)
        })

        expect(res?.strategy).toBe('collateral-only')
        expect(res?.txHash).toBe('0xdead')
        // Exactly one smart-only broadcast attempt (the one that reverted), and
        // exactly one collateral submission — never both buckets paid.
        expect(mockHandleSendUserOpEncoded).toHaveBeenCalledTimes(1)
        expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(1)
    })

    it('rethrows and does NOT touch collateral when a smart-only failure is not a sweep', async () => {
        mockReadContract.mockResolvedValueOnce(5_000_000n) // routes smart-only
        mockHandleSendUserOpEncoded.mockRejectedValueOnce(new Error('bundler down'))
        mockReadContract.mockResolvedValueOnce(5_000_000n) // re-read: still covers → not a sweep

        const { result } = renderHook(() => useSpendBundle(), { wrapper })

        await act(async () => {
            await expect(result.current.spend(spendInput)).rejects.toThrow('bundler down')
        })

        expect(mockHandleSendUserOpEncoded).toHaveBeenCalledTimes(1)
        expect(mockSubmitWithdrawal).not.toHaveBeenCalled()
    })
})
