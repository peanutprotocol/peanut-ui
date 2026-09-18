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
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import posthog from 'posthog-js'
import { submitSignedSpend } from '../signSpendRetry'
import { useSignSpendBundle } from '../useSignSpendBundle'
import { InsufficientSpendableError, resolveSpendStrategy, runCollateralSpendPreflight } from '../spendPreflight'
import { rainApi, RainCooldownError } from '@/services/rain'
import { API_ERROR_CODES, ApiError } from '@/services/api-error'
import { getSpendArtifactMeta, SpendRecoveryAbortedError, SpendRecoveryQuoteReviewError } from '../signSpendRetry'
import { signMixedEphemeralSpend } from '../mixedEphemeralSign'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

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
        {
            type: 'function',
            name: 'withdrawAsset',
            // the mixed two-tap path encodes the real 10-arg call
            inputs: [
                { name: 'proxy', type: 'address' },
                { name: 'token', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'recipient', type: 'address' },
                { name: 'expiresAt', type: 'uint256' },
                { name: 'executorSalt', type: 'bytes32' },
                { name: 'executorSignature', type: 'bytes' },
                { name: 'adminSalts', type: 'bytes32[]' },
                { name: 'adminSignatures', type: 'bytes[]' },
                { name: 'directTransfer', type: 'bool' },
            ],
            outputs: [],
            stateMutability: 'nonpayable',
        },
    ],
}))
const mockSignTypedData = jest.fn()
const mockGetPatchedSudoValidator = jest.fn(async () => ({ validator: 'patched' }))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        getClientForChain: () => ({ account: { address: ACCOUNT, signTypedData: mockSignTypedData } }),
        rebuildClientForChain: jest.fn(),
        getPatchedSudoValidator: () => mockGetPatchedSudoValidator(),
    }),
}))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: { tag: 'public' } }))
const mockSessionKeySignEnabled = jest.fn(() => false)
jest.mock('@/constants/session-key-sign.consts', () => ({
    sessionKeySignEnabled: (contract: unknown) =>
        mockSessionKeySignEnabled() && contract === 'broadcast-first-revert-v1',
}))
jest.mock('../mixedEphemeralSign', () => ({ signMixedEphemeralSpend: jest.fn() }))
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: () => ({ handleSendUserOpEncoded: jest.fn() }) }))
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
const mockSignCallsUserOp = jest.fn(async () => ({ signedUserOp: { signature: '0xpasskey' } }))
jest.mock('../useSignUserOp', () => ({ useSignUserOp: () => ({ signCallsUserOp: mockSignCallsUserOp }) }))
jest.mock('@/utils/rainWithdraw.utils', () => ({ buildRainWithdrawTypedData: jest.fn(() => ({})) }))
jest.mock('@/services/rain', () => ({
    // Real shape: the engines narrow a cooldown with `instanceof`.
    RainCooldownError: class RainCooldownError extends Error {
        readonly retryAfterSec: number | null
        constructor(message: string, retryAfterSec: number | null) {
            super(message)
            this.name = 'RainCooldownError'
            this.retryAfterSec = retryAfterSec
        }
    },
    rainApi: { prepareWithdrawal: jest.fn(), cancelPreparation: jest.fn(), refreshControllerAddress: jest.fn() },
}))
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
const mockRefreshController = rainApi.refreshControllerAddress as jest.Mock
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
    adminSalt: '0x3333333333333333333333333333333333333333333333333333333333333333',
    adminNonce: '1',
    executorSignature: '0x44',
    executorSalt: '0x5555555555555555555555555555555555555555555555555555555555555555',
    expiresAt: 1234567890,
    mixedSpendContract: 'broadcast-first-revert-v1',
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
    mockRefreshController.mockResolvedValue({ coordinatorAddress: PREP.coordinatorAddress, changed: false })
    mockOverview = { cards: [] }
    mockFreshOverview = { cards: [] }
    mockGrant.mockResolvedValue({ ok: true, overviewFresh: true })
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
        // The backend chooses the intent kind (TASK-21815) — the wire call
        // carries no client-declared kind.
        expect(mockPrepareWithdrawal).toHaveBeenCalledWith(
            {
                amount: '15000', // USDC units → Rain cents
                recipientAddress: RECIPIENT,
                directTransfer: true,
            },
            // A normal spend keeps the global cooldown explainer.
            { suppressCooldownEvent: false }
        )
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

    it('backs the draft out when the flow dies after a successful prepare (TASK-21815)', async () => {
        const mockCancelPreparation = rainApi.cancelPreparation as jest.Mock
        // Prepare succeeds, the admin signature ceremony throws (user
        // dismissed the passkey prompt) — the hook must fire the best-effort
        // cancel for the orphaned draft.
        mockSignTypedData.mockRejectedValueOnce(new Error('ceremony dismissed'))
        const { result } = renderHook(() => useSignSpendBundle(), { wrapper })
        await act(async () => {
            await expect(
                result.current.signSpend({
                    requiredUsdcAmount: 150_000_000n,
                    recipient: RECIPIENT,
                    rainSpendingPower: 200_000_000n,
                    kind: 'AUTO_REBALANCE',
                    forceStrategy: 'collateral-only',
                })
            ).rejects.toThrow('ceremony dismissed')
        })
        expect(mockCancelPreparation).toHaveBeenCalledWith('prep-1')
    })
})

/** QR / Manteca sign here and let the backend submit, so the approval the
 *  backend will check has to be current at SIGNING time — /prepare is what
 *  says which controller that is. */
describe('useSignSpendBundle — prepared-controller approval gate (TASK-22734)', () => {
    const COORD_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const COORD_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    const card = (hasWithdrawApproval: boolean) => [{ id: 'card-1', status: 'ACTIVE', hasWithdrawApproval }]

    function signCollateralOnly() {
        const { result } = renderHook(() => useSignSpendBundle(), { wrapper })
        return act(async () =>
            result.current
                .signSpend({
                    requiredUsdcAmount: 150_000_000n,
                    recipient: RECIPIENT,
                    rainSpendingPower: 200_000_000n,
                    kind: 'QR_PAY',
                    forceStrategy: 'collateral-only',
                })
                .catch((e: Error) => e)
        )
    }

    it('A→B: one refetch, one grant before the admin signature, artifact still produced', async () => {
        mockOverview = { status: { coordinatorAddress: COORD_A }, cards: card(true) }
        mockFreshOverview = { status: { coordinatorAddress: COORD_B }, cards: card(false) }
        mockPrepareWithdrawal.mockResolvedValue({ ...PREP, coordinatorAddress: COORD_B })

        const artifact = (await signCollateralOnly()) as unknown as { strategy: string }

        expect(artifact).toMatchObject({ strategy: 'collateral-only' })
        expect(mockRefetchOverview).toHaveBeenCalledTimes(1)
        expect(mockGrant).toHaveBeenCalledTimes(1)
        expect(mockGrant.mock.invocationCallOrder[0]).toBeLessThan(mockSignTypedData.mock.invocationCallOrder[0])
        expect(rainApi.cancelPreparation).not.toHaveBeenCalled()
        expect(mockRefreshController).not.toHaveBeenCalled()
    })

    it('an already-current overview signs with no refetch and no grant', async () => {
        mockOverview = { status: { coordinatorAddress: COORD_B }, cards: card(true) }
        mockPrepareWithdrawal.mockResolvedValue({ ...PREP, coordinatorAddress: COORD_B })

        await signCollateralOnly()

        expect(mockRefetchOverview).not.toHaveBeenCalled()
        expect(mockGrant).not.toHaveBeenCalled()
        expect(mockSignTypedData).toHaveBeenCalledTimes(1)
    })

    it('a cancelled grant yields no signature and backs the draft out', async () => {
        mockOverview = { status: { coordinatorAddress: COORD_A }, cards: card(true) }
        mockFreshOverview = { status: { coordinatorAddress: COORD_B }, cards: card(false) }
        mockPrepareWithdrawal.mockResolvedValue({ ...PREP, coordinatorAddress: COORD_B })
        mockGrant.mockResolvedValue({ ok: false, error: { kind: 'user-cancelled' } })

        const error = (await signCollateralOnly()) as unknown as Error

        expect(error.name).toBe('SessionKeyGrantRequiredError')
        expect(mockSignTypedData).not.toHaveBeenCalled()
        expect(rainApi.cancelPreparation).toHaveBeenCalledWith('prep-1')
        expect(mockRefreshController).not.toHaveBeenCalled()
    })

    it('mixed signs without any grant even when the prepared coordinator moved', async () => {
        mockResolveSpendStrategy.mockResolvedValue({ strategy: 'mixed', smartBalance: 50_000_000n })
        mockOverview = { status: { coordinatorAddress: COORD_A }, cards: card(false) }
        mockPrepareWithdrawal.mockResolvedValue({ ...PREP, coordinatorAddress: COORD_B })

        const { result } = renderHook(() => useSignSpendBundle(), { wrapper })
        await act(async () => {
            await result.current.signSpend({
                requiredUsdcAmount: 150_000_000n,
                recipient: RECIPIENT,
                rainSpendingPower: 200_000_000n,
                kind: 'QR_PAY',
            })
        })

        expect(mockGrant).not.toHaveBeenCalled()
        expect(mockRefetchOverview).not.toHaveBeenCalled()
    })
})

/**
 * Ordinary collateral funding EXECUTES through the mixed pipeline: it is the
 * one with a durable reservation, a precomputed hash and definitive failure
 * codes, so a late rotation is recoverable on the same lock. The funding SOURCE
 * the user's routing picked is preserved — the whole amount still comes from
 * collateral, even when the smart account holds a balance.
 */
describe('useSignSpendBundle — ordinary collateral funding runs on the mixed pipeline', () => {
    function signOrdinary() {
        const { result } = renderHook(() => useSignSpendBundle(), { wrapper })
        return act(async () =>
            result.current.signSpend({
                requiredUsdcAmount: 150_000_000n, // $150
                recipient: RECIPIENT,
                rainSpendingPower: 200_000_000n,
                kind: 'QR_PAY',
            })
        )
    }

    it.each([
        ['an empty smart account', 0n],
        ['a smart account that also has funds', 40_000_000n],
    ])('%s: the FULL amount is drawn from collateral to the kernel', async (_label, smartBalance) => {
        mockResolveSpendStrategy.mockResolvedValue({ strategy: 'collateral-only', smartBalance })

        const artifact = (await signOrdinary()) as unknown as { strategy: string; rainPreparationId?: string }

        expect(artifact.strategy).toBe('mixed')
        expect(artifact.rainPreparationId).toBe('prep-1')
        expect(mockPrepareWithdrawal).toHaveBeenCalledWith(
            {
                // Full required amount, not a shortfall.
                amount: '15000',
                totalAmountCents: '15000',
                // Kernel account is the withdraw beneficiary; the transfer to
                // the recipient rides in the same UserOp.
                recipientAddress: ACCOUNT,
                directTransfer: false,
            },
            { suppressCooldownEvent: false }
        )
    })

    it('keeps the modern capability metadata for late recovery', async () => {
        mockResolveSpendStrategy.mockResolvedValue({ strategy: 'collateral-only', smartBalance: 0n })
        const artifact = (await signOrdinary()) as unknown as object
        expect(getSpendArtifactMeta(artifact)).toEqual({
            coordinatorAddress: PREP.coordinatorAddress,
            mixedSpendContract: 'broadcast-first-revert-v1',
        })
    })

    it('a FORCED collateral-only spend (lock/cancel card) still signs the direct withdrawal', async () => {
        const { result } = renderHook(() => useSignSpendBundle(), { wrapper })
        let artifact: unknown
        await act(async () => {
            artifact = await result.current.signSpend({
                requiredUsdcAmount: 150_000_000n,
                recipient: RECIPIENT,
                rainSpendingPower: 200_000_000n,
                kind: 'AUTO_REBALANCE',
                forceStrategy: 'collateral-only',
            })
        })
        expect((artifact as { strategy: string }).strategy).toBe('collateral-only')
        expect(mockPrepareWithdrawal).toHaveBeenCalledWith(
            expect.objectContaining({ directTransfer: true, recipientAddress: RECIPIENT }),
            { suppressCooldownEvent: false }
        )
        expect(mockResolveSpendStrategy).not.toHaveBeenCalled()
    })
})

/**
 * A rotation can break the mixed prepare/estimate BEFORE any artifact exists.
 * This engine broadcasts nothing, so that attempt is re-run once with the same
 * terms — the first post-rotation QR/offramp must not fail visibly.
 */
describe('useSignSpendBundle — pre-artifact rotation recovery', () => {
    const COORD_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

    beforeEach(() => {
        mockResolveSpendStrategy.mockResolvedValue({ strategy: 'mixed', smartBalance: 50_000_000n })
    })

    function signMixedSpend() {
        const { result } = renderHook(() => useSignSpendBundle(), { wrapper })
        return act(async () =>
            result.current
                .signSpend({
                    requiredUsdcAmount: 150_000_000n,
                    recipient: RECIPIENT,
                    rainSpendingPower: 200_000_000n,
                    kind: 'QR_PAY',
                })
                .catch((e: Error) => e)
        )
    }

    it('estimation fails under A, the controller is now B: re-prepares and returns a fresh artifact once', async () => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: COORD_B, changed: true })
        mockSignCallsUserOp.mockRejectedValueOnce(new Error('execution reverted during gas estimation'))
        mockPrepareWithdrawal
            .mockResolvedValueOnce(PREP)
            .mockResolvedValueOnce({ ...PREP, preparationId: 'prep-2', coordinatorAddress: COORD_B })

        const artifact = (await signMixedSpend()) as unknown as { rainPreparationId?: string }

        expect(artifact.rainPreparationId).toBe('prep-2')
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(2)
        // Same terms; only the recovery attempt owns its cooldown explainer.
        expect(mockPrepareWithdrawal.mock.calls[1][0]).toEqual(mockPrepareWithdrawal.mock.calls[0][0])
        expect(mockPrepareWithdrawal.mock.calls[1][1]).toEqual({ suppressCooldownEvent: true })
        expect(mockCapture).not.toHaveBeenCalledWith(
            ANALYTICS_EVENTS.CARD_WITHDRAW_FAILED,
            expect.objectContaining({ flow: 'sign-only' })
        )
    })

    it('the backend rotation code is accepted with no local prepared target and no extra refresh', async () => {
        mockPrepareWithdrawal
            .mockRejectedValueOnce(
                new ApiError('controller changed', { status: 409, code: API_ERROR_CODES.RAIN_CONTROLLER_CHANGED })
            )
            .mockResolvedValueOnce({ ...PREP, preparationId: 'prep-2' })

        const artifact = (await signMixedSpend()) as unknown as { rainPreparationId?: string }

        expect(artifact.rainPreparationId).toBe('prep-2')
        expect(mockRefreshController).not.toHaveBeenCalled()
    })

    it('an internal 425 after that safe code becomes a quote-review handoff, not a failed payment', async () => {
        mockPrepareWithdrawal
            .mockRejectedValueOnce(
                new ApiError('controller changed', { status: 409, code: API_ERROR_CODES.RAIN_CONTROLLER_CHANGED })
            )
            .mockRejectedValueOnce(new RainCooldownError('cooling down', 300))

        const error = (await signMixedSpend()) as unknown as Error

        expect(error).toBeInstanceOf(SpendRecoveryQuoteReviewError)
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(2)
        expect(mockRefreshController).not.toHaveBeenCalled()
    })

    it('an unchanged controller is not retried', async () => {
        mockSignCallsUserOp.mockRejectedValueOnce(new Error('bundler 502'))
        const error = (await signMixedSpend()) as unknown as Error
        expect(error.message).toBe('bundler 502')
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
    })

    it('a dismissed passkey neither refreshes the controller nor retries', async () => {
        const cancelled = Object.assign(new Error('ceremony dismissed'), { name: 'NotAllowedError' })
        mockSignCallsUserOp.mockRejectedValueOnce(cancelled)
        const error = (await signMixedSpend()) as unknown as Error
        expect(error).toBe(cancelled)
        expect(mockRefreshController).not.toHaveBeenCalled()
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
    })

    it('a controller refresh that resolves AFTER the user leaves prepares nothing more', async () => {
        let releaseRefresh: (value: { coordinatorAddress: string; changed: boolean }) => void = () => {}
        mockRefreshController.mockReturnValueOnce(
            new Promise((resolve) => {
                releaseRefresh = resolve
            })
        )
        mockSignCallsUserOp.mockRejectedValueOnce(new Error('execution reverted during gas estimation'))

        const { result, unmount } = renderHook(() => useSignSpendBundle(), { wrapper })
        let settled: Promise<unknown> | undefined
        await act(async () => {
            settled = result.current
                .signSpend({
                    requiredUsdcAmount: 150_000_000n,
                    recipient: RECIPIENT,
                    rainSpendingPower: 200_000_000n,
                    kind: 'QR_PAY',
                })
                .catch((e: Error) => e)
            await waitFor(() => expect(mockRefreshController).toHaveBeenCalledTimes(1))
        })
        unmount()
        await act(async () => {
            releaseRefresh({ coordinatorAddress: COORD_B, changed: true })
            expect(await settled).toBeInstanceOf(SpendRecoveryAbortedError)
        })

        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
    })

    it('a second failure after the recovery stops and surfaces', async () => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: COORD_B, changed: true })
        mockSignCallsUserOp
            .mockRejectedValueOnce(new Error('still broken'))
            .mockRejectedValueOnce(new Error('still broken'))
        const error = (await signMixedSpend()) as unknown as Error
        expect(error.message).toBe('still broken')
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(2)
    })
})

describe('useSignSpendBundle — cached-controller repair (TASK-22734)', () => {
    function signCollateralOnly() {
        const { result } = renderHook(() => useSignSpendBundle(), { wrapper })
        return act(async () =>
            result.current
                .signSpend({
                    requiredUsdcAmount: 150_000_000n,
                    recipient: RECIPIENT,
                    rainSpendingPower: 200_000_000n,
                    kind: 'FIAT_OFFRAMP',
                    forceStrategy: 'collateral-only',
                })
                .catch((e: Error) => e)
        )
    }

    it('signing a Rain leg successfully asks for no refresh', async () => {
        await signCollateralOnly()
        expect(mockRefreshController).not.toHaveBeenCalled()
    })

    it('a failed Rain leg repairs the cache once and surfaces the original error', async () => {
        mockPrepareWithdrawal.mockRejectedValueOnce(new Error('rain prepare 502'))
        const error = (await signCollateralOnly()) as unknown as Error
        expect(error.message).toBe('rain prepare 502')
        expect(mockRefreshController).toHaveBeenCalledTimes(1)
        // Cache-only: the failed order/preparation is never retried from here.
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
    })

    it('a dismissed passkey prompt is not treated as evidence of a stale controller', async () => {
        const cancelled = new Error('ceremony dismissed')
        cancelled.name = 'NotAllowedError'
        mockSignTypedData.mockRejectedValueOnce(cancelled)
        await signCollateralOnly()
        expect(mockRefreshController).not.toHaveBeenCalled()
    })
})

describe('useSignSpendBundle — mixed, SESSION_KEY_SIGN one-tap path', () => {
    const mockSignEphemeral = signMixedEphemeralSpend as jest.Mock
    const SIGNED = { signedUserOp: { sender: ACCOUNT }, chainId: '42161', entryPointAddress: '0xentry' }

    beforeEach(() => {
        mockResolveSpendStrategy.mockResolvedValue({ strategy: 'mixed', smartBalance: 50_000_000n })
        mockGetPatchedSudoValidator.mockResolvedValue({ validator: 'patched' })
    })

    async function signMixed() {
        const { result } = renderHook(() => useSignSpendBundle(), { wrapper })
        let artifact: Awaited<ReturnType<typeof result.current.signSpend>> | undefined
        await act(async () => {
            artifact = await result.current.signSpend({
                requiredUsdcAmount: 150_000_000n,
                recipient: RECIPIENT,
                rainSpendingPower: 200_000_000n,
                kind: 'QR_PAY',
            })
        })
        return artifact
    }

    it('flag off: the two-tap passkey path signs the admin EIP-712 itself', async () => {
        mockSessionKeySignEnabled.mockReturnValue(false)
        await signMixed()
        expect(mockSignEphemeral).not.toHaveBeenCalled()
        expect(mockSignTypedData).toHaveBeenCalledTimes(1)
    })

    it.each([undefined, 'broadcast-after'])(
        'flags on with incompatible API contract %s uses passkey signing',
        async (mixedSpendContract) => {
            mockSessionKeySignEnabled.mockReturnValue(true)
            mockPrepareWithdrawal.mockResolvedValue({ ...PREP, mixedSpendContract })
            await signMixed()
            expect(mockSignEphemeral).not.toHaveBeenCalled()
            expect(mockSignTypedData).toHaveBeenCalledTimes(1)
        }
    )

    it('flag on: returns the ephemeral-signed artifact for the same prep, no passkey admin signature', async () => {
        mockSessionKeySignEnabled.mockReturnValue(true)
        mockSignEphemeral.mockResolvedValue({ ok: true, signedUserOp: SIGNED })
        const artifact = await signMixed()
        expect(artifact).toEqual({ strategy: 'mixed', signedUserOp: SIGNED, rainPreparationId: 'prep-1' })
        expect(mockSignEphemeral).toHaveBeenCalledWith(
            expect.objectContaining({ prep: PREP, recipient: RECIPIENT, requiredUsdcAmount: 150_000_000n })
        )
        expect(mockSignTypedData).not.toHaveBeenCalled()
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SESSION_KEY_SPEND_ATTEMPTED, {
            kind: 'QR_PAY',
            flow: 'sign-only',
        })
    })

    it('flag on, ephemeral signing fails: falls back to the two-tap path with the SAME prep and reports why', async () => {
        mockSessionKeySignEnabled.mockReturnValue(true)
        mockSignEphemeral.mockResolvedValue({ ok: false, reason: 'ephemeral key: session setup failed' })
        await signMixed()
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
        expect(mockSignTypedData).toHaveBeenCalledTimes(1)
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SESSION_KEY_SPEND_FALLBACK, {
            kind: 'QR_PAY',
            flow: 'sign-only',
            reason: 'ephemeral key: session setup failed',
        })
    })

    it('flag on, sudo validator cannot be resolved: falls back to the two-tap path with the SAME prep', async () => {
        mockSessionKeySignEnabled.mockReturnValue(true)
        mockGetPatchedSudoValidator.mockRejectedValue(new Error('Cannot resolve sudo validator: not authenticated'))
        await signMixed()
        expect(mockSignEphemeral).not.toHaveBeenCalled()
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
        expect(mockSignTypedData).toHaveBeenCalledTimes(1)
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SESSION_KEY_SPEND_FALLBACK, {
            kind: 'QR_PAY',
            flow: 'sign-only',
            reason: 'Cannot resolve sudo validator: not authenticated',
        })
    })
    it('a backend revert forces the next attempt through passkey signing after remount', async () => {
        mockSessionKeySignEnabled.mockReturnValue(true)
        mockSignEphemeral.mockResolvedValue({ ok: true, signedUserOp: SIGNED })
        const artifact = await signMixed()
        const failure = new Error('USER_OP_REVERTED: signed operation reverted on-chain')
        await expect(
            submitSignedSpend(artifact!, async () => {
                throw failure
            })
        ).rejects.toBe(failure)
        mockSignEphemeral.mockClear()
        await signMixed()
        expect(mockSignEphemeral).not.toHaveBeenCalled()
        expect(mockSignTypedData).toHaveBeenCalledTimes(1)
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(2)
        expect(mockSignCallsUserOp).toHaveBeenCalledTimes(1)
    })
})
