/**
 * useSpendBundle — draft back-out boundaries (TASK-21815 review).
 *
 * Three contracts around /rain/cards/withdraw/prepare/cancel:
 *  1. charge-backed prep + failure → NO cancel ever (the prep IS the charge;
 *     cancelling it through the draft door would target the charge intent),
 *  2. standalone prep + PRE-broadcast failure (admin ceremony dies) → exactly
 *     one cancel with the preparation id,
 *  3. standalone prep + POST-broadcast-attempt failure (/submit throws) →
 *     NO cancel — the failure is execution-ambiguous (money may have moved
 *     with the response lost); the backend's probe-verified TTL sweep owns
 *     cleanup.
 */
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSpendBundle } from '../useSpendBundle'
import { resolveSpendStrategy, runCollateralSpendPreflight } from '../spendPreflight'
import { rainApi } from '@/services/rain'

const ACCOUNT = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'
const RECIPIENT = '0x4e5b89fd498f333ed7f2a59c5f23d5b5dc41b3de'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))
const mockSignTypedData = jest.fn()
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        getClientForChain: () => ({ account: { address: ACCOUNT, signTypedData: mockSignTypedData } }),
        rebuildClientForChain: jest.fn(),
    }),
}))
const mockAccounts: Array<{ type: string; identifier: string }> = []
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { accounts: mockAccounts } }),
}))
const mockHandleSendUserOpEncoded = jest.fn()
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleSendUserOpEncoded: mockHandleSendUserOpEncoded }),
}))
jest.mock('@/context/ModalsContext', () => ({ useModalsContextOptional: () => undefined }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: { cards: [] } }),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('../useGrantSessionKey', () => ({ useGrantSessionKey: () => ({ grant: jest.fn() }) }))
jest.mock('@/utils/rainWithdraw.utils', () => ({ buildRainWithdrawTypedData: jest.fn(() => ({})) }))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: {} }))
jest.mock('@/constants/session-key-spend.consts', () => ({ sessionKeySpendEnabled: () => false }))
jest.mock('./../mixedEphemeralSpend', () => ({ tryMixedEphemeralSpend: jest.fn() }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/services/rain', () => ({
    rainApi: { prepareWithdrawal: jest.fn(), cancelPreparation: jest.fn(), submitWithdrawal: jest.fn() },
}))
jest.mock('../spendPreflight', () => ({
    ...jest.requireActual('../spendPreflight'),
    resolveSpendStrategy: jest.fn(),
    runCollateralSpendPreflight: jest.fn(),
}))

const mockResolveSpendStrategy = resolveSpendStrategy as jest.Mock
const mockPreflight = runCollateralSpendPreflight as jest.Mock
const mockPrepareWithdrawal = rainApi.prepareWithdrawal as jest.Mock
const mockSubmitWithdrawal = rainApi.submitWithdrawal as jest.Mock
const mockCancelPreparation = rainApi.cancelPreparation as jest.Mock

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
    adminSalt: `0x${'a'.repeat(64)}`,
    adminNonce: '1',
    executorSignature: `0x${'b'.repeat(130)}`,
    executorSalt: `0x${'c'.repeat(64)}`,
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
    mockResolveSpendStrategy.mockResolvedValue({ strategy: 'collateral-only', smartBalance: 0n })
    mockPrepareWithdrawal.mockResolvedValue(PREP)
    mockSignTypedData.mockResolvedValue('0xadminsig')
    mockSubmitWithdrawal.mockResolvedValue({ txHash: '0x' + 'a'.repeat(64) })
})

function spendInput(overrides: Record<string, unknown> = {}) {
    return {
        requiredUsdcAmount: 150_000_000n,
        recipient: RECIPIENT as `0x${string}`,
        rainSpendingPower: 200_000_000n,
        kind: 'CRYPTO_WITHDRAW' as const,
        ...overrides,
    }
}

describe('useSpendBundle — draft back-out boundaries', () => {
    it('a charge-backed prep is NEVER cancelled, even when signing dies before broadcast', async () => {
        mockSignTypedData.mockRejectedValueOnce(new Error('ceremony dismissed'))
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput({ chargeId: 'charge-42' }))).rejects.toThrow(
                'ceremony dismissed'
            )
        })
        expect(mockCancelPreparation).not.toHaveBeenCalled()
    })

    it('a standalone prep is cancelled once when the failure precedes any broadcast', async () => {
        mockSignTypedData.mockRejectedValueOnce(new Error('ceremony dismissed'))
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('ceremony dismissed')
        })
        expect(mockCancelPreparation).toHaveBeenCalledTimes(1)
        expect(mockCancelPreparation).toHaveBeenCalledWith('prep-1')
    })

    it('a /submit failure is execution-ambiguous — no cancel fires', async () => {
        mockSubmitWithdrawal.mockRejectedValueOnce(new Error('gateway timeout'))
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('gateway timeout')
        })
        expect(mockCancelPreparation).not.toHaveBeenCalled()
    })

    describe('mixed path — the broadcast boundary sits INSIDE the userop helper', () => {
        beforeEach(() => {
            mockAccounts.splice(0, mockAccounts.length, { type: 'peanut-wallet', identifier: ACCOUNT })
            mockResolveSpendStrategy.mockResolvedValue({ strategy: 'mixed', smartBalance: 50_000_000n })
            mockPrepareWithdrawal.mockResolvedValue({ ...PREP, directTransfer: false })
        })
        afterEach(() => mockAccounts.splice(0, mockAccounts.length))

        it('a dismissed second ceremony (WebAuthn rejection) still cancels — the op was never signed', async () => {
            mockHandleSendUserOpEncoded.mockImplementationOnce(async (_calls, _chain, opts) => {
                opts?.onBroadcastAttempt?.()
                const err = new Error('ceremony dismissed')
                err.name = 'NotAllowedError'
                throw err
            })
            const { result } = renderHook(() => useSpendBundle(), { wrapper })
            await act(async () => {
                await expect(result.current.spend(spendInput())).rejects.toThrow('ceremony dismissed')
            })
            expect(mockCancelPreparation).toHaveBeenCalledWith('prep-1')
        })

        it('a post-broadcast bundler failure is execution-ambiguous — no cancel fires', async () => {
            mockHandleSendUserOpEncoded.mockImplementationOnce(async (_calls, _chain, opts) => {
                opts?.onBroadcastAttempt?.()
                throw new Error('bundler 502')
            })
            const { result } = renderHook(() => useSpendBundle(), { wrapper })
            await act(async () => {
                await expect(result.current.spend(spendInput())).rejects.toThrow('bundler 502')
            })
            expect(mockCancelPreparation).not.toHaveBeenCalled()
        })
    })
})
