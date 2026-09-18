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
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSpendBundle } from '../useSpendBundle'
import { resolveSpendStrategy, runCollateralSpendPreflight } from '../spendPreflight'
import { tryMixedEphemeralSpend } from '../mixedEphemeralSpend'
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
        getPatchedSudoValidator: jest.fn(async () => ({})),
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
jest.mock('./../mixedEphemeralSpend', () => ({ tryMixedEphemeralSpend: jest.fn() }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/services/rain', () => ({
    rainApi: {
        prepareWithdrawal: jest.fn(),
        cancelPreparation: jest.fn(),
        submitWithdrawal: jest.fn(),
        stampWithdrawal: jest.fn(),
        refreshControllerAddress: jest.fn(),
    },
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
const mockRefreshController = rainApi.refreshControllerAddress as jest.Mock

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
    // one-tap is ungated: the mixed path always tries the ephemeral spend first.
    // Default: it declines without crossing the broadcast boundary.
    ;(tryMixedEphemeralSpend as jest.Mock).mockResolvedValue({ ok: false, reason: 'no session key' })
    mockPrepareWithdrawal.mockResolvedValue(PREP)
    mockSignTypedData.mockResolvedValue('0xadminsig')
    mockSubmitWithdrawal.mockResolvedValue({ txHash: '0x' + 'a'.repeat(64) })
    mockRefreshController.mockResolvedValue({ coordinatorAddress: PREP.coordinatorAddress, changed: false })
    ;(rainApi.stampWithdrawal as jest.Mock).mockResolvedValue(undefined)
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

        it('a crossed session-key attempt stays ambiguous — a later ceremony rejection must NOT cancel', async () => {
            // The ephemeral attempt broadcasts (boundary crossed) and falls
            // through; the passkey fallback reuses the SAME prep and its
            // ceremony is dismissed. The ceremony carve-out must not override
            // the earlier ambiguous broadcast (Chip-filed follow-up on r2).
            // one-tap is on for everyone now (no gate) — the ephemeral attempt always runs on mixed
            const mockEphemeral = tryMixedEphemeralSpend as jest.Mock
            mockEphemeral.mockImplementationOnce(async (args) => {
                args.onBroadcastAttempt?.()
                return { ok: false, reason: 'timeout waiting for receipt' }
            })
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
            expect(mockCancelPreparation).not.toHaveBeenCalled()
            // ...and the cancellation must not hide the Rain failure that
            // preceded it from the controller-cache repair.
            expect(mockRefreshController).toHaveBeenCalledTimes(1)
        })
    })
})

/**
 * Controller-cache repair (TASK-22734). The backend serves the Rain controller
 * from its own cache, so a rotation only shows up when something built against
 * the stale address fails — and the mixed/ephemeral UserOps this engine
 * broadcasts CLIENT-side are exactly the failures the backend never sees.
 * Repair is cache-only: one call, no resubmission, original error untouched.
 */
describe('useSpendBundle — cached-controller repair', () => {
    it('a successful spend never asks for a refresh', async () => {
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await result.current.spend(spendInput())
        })
        expect(mockRefreshController).not.toHaveBeenCalled()
    })

    it('a wallet-only (smart-only) failure never asks for a refresh — no Rain leg was involved', async () => {
        mockResolveSpendStrategy.mockResolvedValue({ strategy: 'smart-only', smartBalance: 200_000_000n })
        mockHandleSendUserOpEncoded.mockRejectedValueOnce(new Error('bundler 502'))
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('bundler 502')
        })
        expect(mockRefreshController).not.toHaveBeenCalled()
    })

    it('a failed Rain leg repairs the cache exactly once and still throws the original error', async () => {
        mockSubmitWithdrawal.mockRejectedValueOnce(new Error('gateway timeout'))
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('gateway timeout')
        })
        expect(mockRefreshController).toHaveBeenCalledTimes(1)
    })

    it('a refresh failure does not mask the original failure', async () => {
        mockSubmitWithdrawal.mockRejectedValueOnce(new Error('gateway timeout'))
        mockRefreshController.mockRejectedValueOnce(new Error('provider lookup failed'))
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('gateway timeout')
        })
        expect(mockRefreshController).toHaveBeenCalledTimes(1)
    })

    it('a changed address refreshes the displayed overview; an unchanged one leaves it alone', async () => {
        const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
        mockSubmitWithdrawal.mockRejectedValue(new Error('gateway timeout'))
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('gateway timeout')
        })
        expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['rain-card-overview'] })

        mockRefreshController.mockResolvedValue({ coordinatorAddress: `0x${'e'.repeat(40)}`, changed: true })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('gateway timeout')
        })
        await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rain-card-overview'] }))
    })

    describe('mixed path', () => {
        beforeEach(() => {
            mockAccounts.splice(0, mockAccounts.length, { type: 'peanut-wallet', identifier: ACCOUNT })
            mockResolveSpendStrategy.mockResolvedValue({ strategy: 'mixed', smartBalance: 50_000_000n })
            mockPrepareWithdrawal.mockResolvedValue({ ...PREP, directTransfer: false })
        })
        afterEach(() => mockAccounts.splice(0, mockAccounts.length))

        it('an ambiguous broadcast timeout repairs the cache WITHOUT a second submission', async () => {
            // The client broadcast and then lost the answer: funds may have
            // moved. Repairing the cache is safe; re-preparing or re-sending is
            // not, and must not happen.
            mockHandleSendUserOpEncoded.mockImplementationOnce(async (_calls, _chain, opts) => {
                opts?.onBroadcastAttempt?.()
                throw new Error('timeout waiting for receipt')
            })
            const { result } = renderHook(() => useSpendBundle(), { wrapper })
            await act(async () => {
                await expect(result.current.spend(spendInput())).rejects.toThrow('timeout waiting for receipt')
            })
            expect(mockRefreshController).toHaveBeenCalledTimes(1)
            expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
            expect(mockHandleSendUserOpEncoded).toHaveBeenCalledTimes(1)
            expect(tryMixedEphemeralSpend).toHaveBeenCalledTimes(1)
            expect(mockSubmitWithdrawal).not.toHaveBeenCalled()
        })

        it('a dismissed passkey prompt does not spend the provider-repair budget', async () => {
            mockHandleSendUserOpEncoded.mockImplementationOnce(async () => {
                const err = new Error('ceremony dismissed')
                err.name = 'NotAllowedError'
                throw err
            })
            const { result } = renderHook(() => useSpendBundle(), { wrapper })
            await act(async () => {
                await expect(result.current.spend(spendInput())).rejects.toThrow('ceremony dismissed')
            })
            expect(mockRefreshController).not.toHaveBeenCalled()
        })

        it('the one-tap attempt falling back to a SUCCESSFUL passkey spend asks for no refresh', async () => {
            ;(tryMixedEphemeralSpend as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'no session key' })
            mockHandleSendUserOpEncoded.mockResolvedValueOnce({ userOpHash: '0xuserop', receipt: null })
            const { result } = renderHook(() => useSpendBundle(), { wrapper })
            await act(async () => {
                await result.current.spend(spendInput())
            })
            expect(mockRefreshController).not.toHaveBeenCalled()
        })
    })
})
