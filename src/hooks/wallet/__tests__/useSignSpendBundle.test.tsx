/**
 * Direct tests for useSignSpendBundle's FORCED collateral-only branch
 * (`forceStrategy: 'collateral-only'`) — used by flows whose purpose is
 * moving collateral itself (excess return after a limit decrease), where
 * live-balance routing would wrongly pick smart-only.
 *
 * Contracts:
 *  1. sufficient collateral → signs and returns a collateral-only artifact
 *     WITHOUT consulting resolveSpendStrategy (no live-balance read),
 *  2. insufficient collateral → captures the CARD_WITHDRAW_FAILED funnel
 *     event, refreshes the overview, and throws InsufficientSpendableError
 *     — same handling as resolveSpendStrategy's insufficient branch.
 */
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import posthog from 'posthog-js'
import { useSignSpendBundle } from '../useSignSpendBundle'
import { InsufficientSpendableError, resolveSpendStrategy, runCollateralSpendPreflight } from '../spendPreflight'
import { rainApi } from '@/services/rain'

const ACCOUNT = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'
const RECIPIENT = '0x4e5b89fd498f333ed7f2a59c5f23d5b5dc41b3de'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))
jest.mock('@/constants/rain.consts', () => ({
    rainCoordinatorAbi: [
        { type: 'function', name: 'withdrawAsset', inputs: [], outputs: [], stateMutability: 'nonpayable' },
    ],
}))
const mockSignTypedData = jest.fn()
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        getClientForChain: () => ({ account: { address: ACCOUNT, signTypedData: mockSignTypedData } }),
        rebuildClientForChain: jest.fn(),
    }),
}))
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: () => ({ handleSendUserOpEncoded: jest.fn() }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContextOptional: () => undefined }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: { cards: [] } }),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('../useGrantSessionKey', () => ({ useGrantSessionKey: () => ({ grant: jest.fn() }) }))
jest.mock('../useSignUserOp', () => ({ useSignUserOp: () => ({ signCallsUserOp: jest.fn() }) }))
jest.mock('@/utils/rainWithdraw.utils', () => ({ buildRainWithdrawTypedData: jest.fn(() => ({})) }))
jest.mock('@/services/rain', () => ({ rainApi: { prepareWithdrawal: jest.fn() } }))
// Keep the real InsufficientSpendableError class (instanceof must hold);
// mock only the two engine entry points.
jest.mock('../spendPreflight', () => ({
    ...jest.requireActual('../spendPreflight'),
    resolveSpendStrategy: jest.fn(),
    runCollateralSpendPreflight: jest.fn(),
}))

const mockResolveSpendStrategy = resolveSpendStrategy as jest.Mock
const mockPreflight = runCollateralSpendPreflight as jest.Mock
const mockPrepareWithdrawal = rainApi.prepareWithdrawal as jest.Mock
const mockCapture = posthog.capture as jest.Mock

const PREP = {
    preparationId: 'prep-1',
    coordinatorAddress: '0xc0d5bd6307ec8c8da03e7502a00b8cba24eefc06',
    collateralProxy: '0x1111111111111111111111111111111111111111',
    adminAddress: ACCOUNT,
    chainId: '42161',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    amount: '150000000',
    recipientAddress: RECIPIENT,
    directTransfer: true,
    adminSalt: '0xsalt',
    adminNonce: '1',
    executorSignature: '0xexecsig',
    executorSalt: '0xexecsalt',
    expiresAt: 1234567890,
}

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
    jest.clearAllMocks()
    queryClient = new QueryClient()
    mockPreflight.mockImplementation(async ({ kernelClient }) => kernelClient)
    mockPrepareWithdrawal.mockResolvedValue(PREP)
    mockSignTypedData.mockResolvedValue('0xadminsig')
})

describe('useSignSpendBundle — forceStrategy: collateral-only', () => {
    it('signs a collateral-only withdrawal without consulting live-balance routing', async () => {
        const { result } = renderHook(() => useSignSpendBundle(), { wrapper })
        let artifact: Awaited<ReturnType<typeof result.current.signSpend>> | undefined
        await act(async () => {
            artifact = await result.current.signSpend({
                requiredUsdcAmount: 150_000_000n, // $150
                recipient: RECIPIENT,
                rainSpendingPower: 200_000_000n, // $200 — sufficient
                kind: 'AUTO_REBALANCE',
                forceStrategy: 'collateral-only',
            })
        })
        expect(mockResolveSpendStrategy).not.toHaveBeenCalled()
        expect(mockPrepareWithdrawal).toHaveBeenCalledWith({
            amount: '15000', // USDC units → Rain cents
            recipientAddress: RECIPIENT,
            directTransfer: true,
            kind: 'AUTO_REBALANCE',
        })
        expect(artifact).toEqual({
            strategy: 'collateral-only',
            rainWithdrawal: expect.objectContaining({
                preparationId: 'prep-1',
                amount: PREP.amount,
                adminSignature: '0xadminsig',
                directTransfer: true,
            }),
        })
    })

    it('insufficient collateral: captures the funnel event, refreshes the overview, throws', async () => {
        const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderHook(() => useSignSpendBundle(), { wrapper })
        await act(async () => {
            await expect(
                result.current.signSpend({
                    requiredUsdcAmount: 200_000_000n,
                    recipient: RECIPIENT,
                    rainSpendingPower: 150_000_000n, // short
                    kind: 'AUTO_REBALANCE',
                    forceStrategy: 'collateral-only',
                })
            ).rejects.toBeInstanceOf(InsufficientSpendableError)
        })
        expect(mockCapture).toHaveBeenCalledWith('card_withdraw_failed', {
            strategy: 'insufficient',
            error_kind: 'insufficient',
            flow: 'sign-only',
        })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rain-card-overview'] })
        expect(mockResolveSpendStrategy).not.toHaveBeenCalled()
        expect(mockPrepareWithdrawal).not.toHaveBeenCalled()
    })
})
