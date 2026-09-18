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
import { resolveSpendStrategy, runCollateralSpendPreflight, SessionKeyGrantRequiredError } from '../spendPreflight'
import { tryMixedEphemeralSpend } from '../mixedEphemeralSpend'
import { rainApi, RainCooldownError } from '@/services/rain'
import { API_ERROR_CODES, ApiError } from '@/services/api-error'
import { userOpRevertedError } from '@/utils/userop-rescue.utils'

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
// The post-prepare approval gate reads the cached overview and, only when it
// disagrees with the prepared coordinator, the refetched one.
let mockOverview: unknown = { cards: [] }
let mockFreshOverview: unknown = { cards: [] }
const mockRefetchOverview = jest.fn(async () => ({ data: mockFreshOverview }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: mockOverview, refetch: mockRefetchOverview }),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
const mockGrant = jest.fn()
jest.mock('../useGrantSessionKey', () => ({
    useGrantSessionKey: () => ({ grant: (...args: unknown[]) => mockGrant(...args) }),
}))
jest.mock('@/utils/rainWithdraw.utils', () => ({ buildRainWithdrawTypedData: jest.fn(() => ({})) }))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: {} }))
jest.mock('./../mixedEphemeralSpend', () => ({ tryMixedEphemeralSpend: jest.fn() }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/services/rain', () => ({
    // Real shape: the hook narrows a cooldown with `instanceof`.
    RainCooldownError: class RainCooldownError extends Error {
        readonly retryAfterSec: number | null
        constructor(message: string, retryAfterSec: number | null) {
            super(message)
            this.name = 'RainCooldownError'
            this.retryAfterSec = retryAfterSec
        }
    },
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
    mockOverview = { cards: [] }
    mockFreshOverview = { cards: [] }
    mockGrant.mockResolvedValue({ ok: true, overviewFresh: true })
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
 * Controller-bound approval gate (TASK-22734). The prep states the coordinator
 * this withdrawal targets, so the approval the collateral-only submit is checked
 * against must be validated between prepare and the admin signature — a cached
 * overview can be behind. A rotation must complete the SAME payment.
 */
describe('useSpendBundle — prepared-controller approval gate', () => {
    const COORD_A = '0xc0d5bd6307ec8c8da03e7502a00b8cba24eefc06'
    const COORD_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const card = (hasWithdrawApproval: boolean) => [{ id: 'card-1', status: 'ACTIVE', hasWithdrawApproval }]

    afterEach(() => mockAccounts.splice(0, mockAccounts.length))

    it('A→B: refetches once, grants once BEFORE signing, and the payment still succeeds', async () => {
        mockOverview = { status: { coordinatorAddress: COORD_A }, cards: card(true) }
        // The backend refreshed its record during /prepare, so the refetched
        // overview reports the rotation and the now-dead approval.
        mockFreshOverview = { status: { coordinatorAddress: COORD_B }, cards: card(false) }
        mockPrepareWithdrawal.mockResolvedValue({ ...PREP, coordinatorAddress: COORD_B })
        const onGrantRequired = jest.fn()

        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        let out: Awaited<ReturnType<typeof result.current.spend>> | undefined
        await act(async () => {
            out = await result.current.spend(spendInput({ onGrantRequired }))
        })

        expect(out).toMatchObject({ strategy: 'collateral-only', intentId: 'prep-1' })
        expect(mockRefetchOverview).toHaveBeenCalledTimes(1)
        expect(mockGrant).toHaveBeenCalledTimes(1)
        expect(onGrantRequired).toHaveBeenCalledTimes(1)
        // The re-grant has to precede the admin signature it re-authorizes.
        expect(mockGrant.mock.invocationCallOrder[0]).toBeLessThan(mockSignTypedData.mock.invocationCallOrder[0])
        expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(1)
        // No failure path: no draft back-out, no late cache repair.
        expect(mockCancelPreparation).not.toHaveBeenCalled()
        expect(mockRefreshController).not.toHaveBeenCalled()
    })

    it('overview already on the prepared controller with a live grant: no refetch, no grant', async () => {
        mockOverview = { status: { coordinatorAddress: COORD_B }, cards: card(true) }
        mockPrepareWithdrawal.mockResolvedValue({ ...PREP, coordinatorAddress: COORD_B })

        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await result.current.spend(spendInput())
        })

        expect(mockRefetchOverview).not.toHaveBeenCalled()
        expect(mockGrant).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(1)
    })

    it('a cancelled grant aborts before signing or submitting, and backs the draft out', async () => {
        mockOverview = { status: { coordinatorAddress: COORD_A }, cards: card(true) }
        mockFreshOverview = { status: { coordinatorAddress: COORD_B }, cards: card(false) }
        mockPrepareWithdrawal.mockResolvedValue({ ...PREP, coordinatorAddress: COORD_B })
        mockGrant.mockResolvedValue({ ok: false, error: { kind: 'user-cancelled' } })

        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toBeInstanceOf(SessionKeyGrantRequiredError)
        })

        expect(mockSignTypedData).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawal).not.toHaveBeenCalled()
        expect(mockCancelPreparation).toHaveBeenCalledWith('prep-1')
        // A dismissed prompt is not evidence of a stale controller.
        expect(mockRefreshController).not.toHaveBeenCalled()
    })

    it('mixed never re-grants — its prep already carries the current coordinator', async () => {
        mockAccounts.splice(0, mockAccounts.length, { type: 'peanut-wallet', identifier: ACCOUNT })
        mockResolveSpendStrategy.mockResolvedValue({ strategy: 'mixed', smartBalance: 50_000_000n })
        mockOverview = { status: { coordinatorAddress: COORD_A }, cards: card(false) }
        mockPrepareWithdrawal.mockResolvedValue({ ...PREP, directTransfer: false, coordinatorAddress: COORD_B })
        mockHandleSendUserOpEncoded.mockResolvedValueOnce({ userOpHash: '0xuserop', receipt: null })

        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await result.current.spend(spendInput())
        })

        expect(mockGrant).not.toHaveBeenCalled()
        expect(mockRefetchOverview).not.toHaveBeenCalled()
    })
})

/**
 * Direct mixed leg: this engine broadcasts itself, so a replay is only safe
 * when a receipt PROVED every broadcast reverted (or none happened) and the
 * controller really moved. A fresh preparation changes replay safety, so any
 * earlier ambiguous broadcast disqualifies the leg for good.
 */
describe('useSpendBundle — mixed controller-rotation recovery', () => {
    const NEW_COORD = `0x${'e'.repeat(40)}`
    // Proof comes from receipt.success === false and nothing else.
    const reverted = () => userOpRevertedError(`0x${'f'.repeat(64)}`, false)
    const revertUnknownReceipt = () => userOpRevertedError(`0x${'f'.repeat(64)}`, undefined)

    beforeEach(() => {
        mockAccounts.splice(0, mockAccounts.length, { type: 'peanut-wallet', identifier: ACCOUNT })
        mockResolveSpendStrategy.mockResolvedValue({ strategy: 'mixed', smartBalance: 50_000_000n })
        mockPrepareWithdrawal.mockResolvedValue({ ...PREP, directTransfer: false })
    })
    afterEach(() => mockAccounts.splice(0, mockAccounts.length))

    const broadcastThen = (fail: () => Error) => async (_calls: unknown, _chain: unknown, opts?: any) => {
        opts?.onBroadcastAttempt?.()
        throw fail()
    }

    it('mined revert + moved controller: one fresh prep + fresh signature, then success', async () => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        mockPrepareWithdrawal
            .mockResolvedValueOnce({ ...PREP, directTransfer: false })
            .mockResolvedValueOnce({ ...PREP, directTransfer: false, preparationId: 'prep-2' })
        mockHandleSendUserOpEncoded
            .mockImplementationOnce(broadcastThen(reverted))
            .mockResolvedValueOnce({ userOpHash: '0xuserop2', receipt: null })

        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        let out: Awaited<ReturnType<typeof result.current.spend>> | undefined
        await act(async () => {
            out = await result.current.spend(spendInput())
        })

        expect(out).toMatchObject({ strategy: 'mixed', intentId: 'prep-2' })
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(2)
        expect(mockSignTypedData).toHaveBeenCalledTimes(2)
        expect(mockHandleSendUserOpEncoded).toHaveBeenCalledTimes(2)
        // Cancelling the superseded prep would only be refused, and never
        // touches Rain's signature state — so it is not attempted.
        expect(mockCancelPreparation).not.toHaveBeenCalled()
    })

    it('a revert whose receipt did not report success === false is NOT proof, so nothing is replayed', async () => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        mockHandleSendUserOpEncoded.mockImplementationOnce(broadcastThen(revertUnknownReceipt))
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('UserOperation reverted on-chain')
        })
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
    })

    it('mined revert with an UNCHANGED controller is not replayed', async () => {
        mockHandleSendUserOpEncoded.mockImplementationOnce(broadcastThen(reverted))
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('UserOperation reverted on-chain')
        })
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
    })

    it('an earlier AMBIGUOUS ephemeral broadcast is never rehabilitated by a later confirmed revert', async () => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        ;(tryMixedEphemeralSpend as jest.Mock).mockImplementationOnce(async (args) => {
            args.onBroadcastAttempt?.()
            return { ok: false, reason: 'timeout waiting for receipt' }
        })
        mockHandleSendUserOpEncoded.mockImplementationOnce(broadcastThen(reverted))

        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('UserOperation reverted on-chain')
        })
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
        expect(mockCancelPreparation).not.toHaveBeenCalled()
    })

    it('a provable pre-broadcast failure + moved controller recovers', async () => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        mockHandleSendUserOpEncoded
            .mockRejectedValueOnce(new Error('execution reverted during gas estimation'))
            .mockResolvedValueOnce({ userOpHash: '0xuserop2', receipt: null })

        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await result.current.spend(spendInput())
        })
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(2)
    })

    it('stops after one recovery', async () => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        mockHandleSendUserOpEncoded.mockImplementation(broadcastThen(reverted))
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('UserOperation reverted on-chain')
        })
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(2)
        expect(mockHandleSendUserOpEncoded).toHaveBeenCalledTimes(2)
    })

    it('a dismissed passkey prompt never re-prepares or re-submits', async () => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        mockHandleSendUserOpEncoded.mockImplementationOnce(async () => {
            const err = new Error('ceremony dismissed')
            err.name = 'NotAllowedError'
            throw err
        })
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('ceremony dismissed')
        })
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
        expect(mockHandleSendUserOpEncoded).toHaveBeenCalledTimes(1)
    })
})

/**
 * Same-flow recovery from the backend's pre-effect rotation signal. The code is
 * emitted only by verifyRainWithdrawal — before any order, claim or broadcast —
 * so the payment can be re-prepared once instead of failing the user.
 */
describe('useSpendBundle — RAIN_CONTROLLER_CHANGED recovery', () => {
    const controllerChanged = () =>
        new ApiError('Rain controller changed', { status: 409, code: API_ERROR_CODES.RAIN_CONTROLLER_CHANGED })

    beforeEach(() => {
        mockOverview = {
            status: { coordinatorAddress: PREP.coordinatorAddress },
            cards: [{ id: 'card-1', status: 'ACTIVE', hasWithdrawApproval: true }],
        }
    })

    it('re-prepares, re-signs and submits once more, and the payment succeeds', async () => {
        mockSubmitWithdrawal.mockRejectedValueOnce(controllerChanged())
        mockPrepareWithdrawal.mockResolvedValueOnce(PREP).mockResolvedValueOnce({ ...PREP, preparationId: 'prep-2' })

        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        let out: Awaited<ReturnType<typeof result.current.spend>> | undefined
        await act(async () => {
            out = await result.current.spend(spendInput())
        })

        expect(out).toMatchObject({ strategy: 'collateral-only', intentId: 'prep-2' })
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(2)
        expect(mockSignTypedData).toHaveBeenCalledTimes(2)
        expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(2)
        // The verify failure already failed that intent — no cancel is attempted.
        expect(mockCancelPreparation).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawal.mock.calls[1][0]).toMatchObject({
            preparationId: 'prep-2',
            // Hint that lets the server classify an outdated artifact.
            preparedCoordinatorAddress: PREP.coordinatorAddress,
        })
        // Recovered, so no failure surface at all.
        expect(mockRefreshController).not.toHaveBeenCalled()
    })

    it('stops after one recovery: a second rotation failure is surfaced', async () => {
        mockSubmitWithdrawal.mockRejectedValue(controllerChanged())
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toBeInstanceOf(ApiError)
        })
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(2)
        expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(2)
    })

    /**
     * A rotation can leave Rain's own signature cooldown active, so the
     * recovery absorbs exactly ONE wait using the backend's retryAfterSec —
     * nothing is broadcast while waiting, and leaving the screen ends it.
     */
    it('waits out the cooldown once, then the fresh prepare + signature succeed', async () => {
        const cooldown = new RainCooldownError('cooling down', 1)
        mockSubmitWithdrawal.mockRejectedValueOnce(controllerChanged())
        mockPrepareWithdrawal
            .mockResolvedValueOnce(PREP)
            .mockRejectedValueOnce(cooldown)
            .mockResolvedValueOnce({ ...PREP, preparationId: 'prep-2' })

        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        let out: Awaited<ReturnType<typeof result.current.spend>> | undefined
        await act(async () => {
            out = await result.current.spend(spendInput())
        })

        expect(out).toMatchObject({ strategy: 'collateral-only', intentId: 'prep-2' })
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(3)
        // The recovery re-prepare owns the cooldown, so no global explainer.
        expect(mockPrepareWithdrawal.mock.calls[1][1]).toEqual({ suppressCooldownEvent: true })
        expect(mockPrepareWithdrawal.mock.calls[0][1]).toEqual({ suppressCooldownEvent: false })
        // Same terms throughout.
        expect(mockPrepareWithdrawal.mock.calls[2][0]).toEqual(mockPrepareWithdrawal.mock.calls[0][0])
        expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(2)
    }, 15_000)

    it('leaving the screen during the wait stops the flow: no further prepare, sign or submit', async () => {
        mockSubmitWithdrawal.mockRejectedValueOnce(controllerChanged())
        mockPrepareWithdrawal.mockResolvedValueOnce(PREP).mockRejectedValue(new RainCooldownError('cooling down', 1))

        const { result, unmount } = renderHook(() => useSpendBundle(), { wrapper })
        let pending: Promise<unknown> | undefined
        await act(async () => {
            pending = result.current.spend(spendInput()).catch((e) => e)
            await Promise.resolve()
        })
        unmount()
        await act(async () => {
            const settled = await pending
            expect((settled as Error).name).toBe('RainCooldownError')
        })

        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(2)
        expect(mockSignTypedData).toHaveBeenCalledTimes(1)
        expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(1)
    }, 15_000)

    it('a cooldown with no retryAfterSec is surfaced instead of guessed at', async () => {
        mockSubmitWithdrawal.mockRejectedValueOnce(controllerChanged())
        mockPrepareWithdrawal.mockResolvedValueOnce(PREP).mockRejectedValueOnce(new RainCooldownError('cooling', null))

        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('cooling')
        })
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(2)
    })

    it('a safe-code response that arrives AFTER the user leaves starts no replacement prepare', async () => {
        let releaseSubmit: (value: unknown) => void = () => {}
        mockSubmitWithdrawal.mockReturnValueOnce(
            new Promise((_resolve, reject) => {
                releaseSubmit = () => reject(controllerChanged())
            })
        )

        const { result, unmount } = renderHook(() => useSpendBundle(), { wrapper })
        let settled: Promise<unknown> | undefined
        await act(async () => {
            settled = result.current.spend(spendInput()).catch((e) => e)
            await waitFor(() => expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(1))
        })
        unmount()
        await act(async () => {
            releaseSubmit(undefined)
            // The original failure keeps its own meaning — it is not relabelled
            // as a cancellation — and nothing new is prepared.
            expect(await settled).toBeInstanceOf(ApiError)
        })

        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
        expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(1)
    })

    it('leaving DURING the replacement prepare stops it before any signature or send', async () => {
        mockSubmitWithdrawal.mockRejectedValueOnce(controllerChanged())
        let releasePrepare: (value: unknown) => void = () => {}
        mockPrepareWithdrawal.mockResolvedValueOnce(PREP).mockReturnValueOnce(
            new Promise((resolve) => {
                releasePrepare = () => resolve({ ...PREP, preparationId: 'prep-2' })
            })
        )

        const { result, unmount } = renderHook(() => useSpendBundle(), { wrapper })
        let settled: Promise<unknown> | undefined
        await act(async () => {
            settled = result.current.spend(spendInput()).catch((e) => e)
            await waitFor(() => expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(2))
        })
        unmount()
        await act(async () => {
            releasePrepare(undefined)
            // The authorising failure keeps its classification.
            expect(await settled).toBeInstanceOf(ApiError)
        })

        // The replacement was prepared but never signed or submitted.
        expect(mockSignTypedData).toHaveBeenCalledTimes(1)
        expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(1)
    })

    it('leaving DURING the replacement signature stops it before the send', async () => {
        mockSubmitWithdrawal.mockRejectedValueOnce(controllerChanged())
        mockPrepareWithdrawal.mockResolvedValueOnce(PREP).mockResolvedValueOnce({ ...PREP, preparationId: 'prep-2' })
        let releaseSign: (value: unknown) => void = () => {}
        mockSignTypedData.mockResolvedValueOnce('0xadminsig').mockReturnValueOnce(
            new Promise((resolve) => {
                releaseSign = () => resolve('0xreplacementsig')
            })
        )

        const { result, unmount } = renderHook(() => useSpendBundle(), { wrapper })
        let settled: Promise<unknown> | undefined
        await act(async () => {
            settled = result.current.spend(spendInput()).catch((e) => e)
            await waitFor(() => expect(mockSignTypedData).toHaveBeenCalledTimes(2))
        })
        unmount()
        await act(async () => {
            releaseSign(undefined)
            expect(await settled).toBeInstanceOf(ApiError)
        })

        // Signed, but never sent: only the original submission happened.
        expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(1)
    })

    it('a generic transport failure is never replayed', async () => {
        mockSubmitWithdrawal.mockRejectedValueOnce(new Error('gateway timeout'))
        const { result } = renderHook(() => useSpendBundle(), { wrapper })
        await act(async () => {
            await expect(result.current.spend(spendInput())).rejects.toThrow('gateway timeout')
        })
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
        expect(mockSubmitWithdrawal).toHaveBeenCalledTimes(1)
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
