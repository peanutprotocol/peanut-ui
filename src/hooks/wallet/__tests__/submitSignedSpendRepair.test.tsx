/**
 * Manteca withdraw + QR pay sign the spend here and let the BACKEND broadcast
 * it, so a Rain leg that fails after signing never reaches this client's own
 * catch. Both callers therefore hand `submitSignedSpend` the repair callback
 * exercised below: cache-only, outcome-preserving, never a retry.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import {
    registerSpendArtifactMeta,
    SpendRecoveryAbortedError,
    SpendRecoveryQuoteReviewError,
    submitSignedSpend,
} from '../signSpendRetry'
import { useRainControllerRepair } from '../useRainControllerRepair'
import { useSignedSpendRecovery } from '../useSignedSpendRecovery'
import { rainApi, RainCooldownError } from '@/services/rain'
import { API_ERROR_CODES, ApiError } from '@/services/api-error'
import type { SignedSpendArtifact } from '../useSignSpendBundle'
import type { SpendStrategy } from '../spendPreflight'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: {} }))
jest.mock('@/services/rain', () => ({
    RainCooldownError: class RainCooldownError extends Error {
        readonly retryAfterSec: number | null
        constructor(message: string, retryAfterSec: number | null) {
            super(message)
            this.name = 'RainCooldownError'
            this.retryAfterSec = retryAfterSec
        }
    },
    rainApi: { refreshControllerAddress: jest.fn(), cancelPreparation: jest.fn() },
}))
jest.mock('@/hooks/useRainCardOverview', () => ({ RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview' }))

const mockRefreshController = rainApi.refreshControllerAddress as jest.Mock
const mockCancelPreparation = rainApi.cancelPreparation as jest.Mock

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
    jest.clearAllMocks()
    queryClient = new QueryClient()
    mockRefreshController.mockResolvedValue({ coordinatorAddress: `0x${'a'.repeat(40)}`, changed: false })
    mockCancelPreparation.mockResolvedValue(undefined)
})

/** The exact wiring used by withdraw/manteca/page.tsx and useQrPayFlow.ts. */
function submitAs<T>(strategy: SpendStrategy, submit: () => Promise<T>): Promise<T> {
    const { result } = renderHook(() => useRainControllerRepair(), { wrapper })
    return submitSignedSpend({ strategy }, submit, {
        onFailure: (failure) => void result.current({ strategy, error: failure }),
    })
}

const REVERTED = { error: 'Failed to broadcast UserOp', message: 'USER_OP_REVERTED: signed operation reverted' }

it('repairs the cache once when the backend reports a confirmed revert, and still returns it', async () => {
    mockRefreshController.mockResolvedValue({ coordinatorAddress: `0x${'b'.repeat(40)}`, changed: true })
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
    const submit = jest.fn(async () => REVERTED)

    await expect(submitAs('mixed', submit)).resolves.toBe(REVERTED)

    expect(mockRefreshController).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledTimes(1)
    // The controller moved — refresh what the card surface displays.
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rain-card-overview'] }))
})

it('an ambiguous rejection keeps its outcome, repairs once and re-submits nothing', async () => {
    const failure = new Error('UserOp receipt timeout - transaction may still be pending')
    const submit = jest.fn(async () => {
        throw failure
    })
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    await expect(submitAs('collateral-only', submit)).rejects.toBe(failure)

    expect(mockRefreshController).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledTimes(1)
    // changed: false — nothing displayed moved, so nothing is invalidated.
    await mockRefreshController.mock.results[0].value
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['rain-card-overview'] })
})

it('a successful or still-pending submission never repairs', async () => {
    await expect(submitAs('mixed', async () => ({ status: 'PENDING' }))).resolves.toEqual({ status: 'PENDING' })
    await expect(submitAs('collateral-only', async () => ({ ok: true }))).resolves.toEqual({ ok: true })
    expect(mockRefreshController).not.toHaveBeenCalled()
})

it('a wallet-only (smart-only) failure never repairs — no Rain leg was involved', async () => {
    const failure = new Error('bundler 502')
    await expect(
        submitAs('smart-only', async () => {
            throw failure
        })
    ).rejects.toBe(failure)
    expect(mockRefreshController).not.toHaveBeenCalled()
})

/**
 * Bounded same-flow recovery: the QR and Manteca call sites hand
 * `submitSignedSpend` a re-sign callback, and only two failures may use it —
 * the backend's pre-effect RAIN_CONTROLLER_CHANGED, and a confirmed
 * USER_OP_REVERTED on a broadcast-first mixed artifact whose controller has
 * actually moved. Everything else keeps its original outcome.
 */
describe('recovery via submitSignedSpend + useSignedSpendRecovery', () => {
    const OLD_COORD = `0x${'a'.repeat(40)}`
    const NEW_COORD = `0x${'b'.repeat(40)}`

    const collateralArtifact = (prep: string, coordinatorAddress = OLD_COORD) =>
        registerSpendArtifactMeta(
            { strategy: 'collateral-only', rainWithdrawal: { preparationId: prep } } as unknown as SignedSpendArtifact,
            { coordinatorAddress }
        )

    const mixedArtifact = (prep: string, mixedSpendContract?: string) =>
        registerSpendArtifactMeta(
            {
                strategy: 'mixed',
                rainPreparationId: prep,
                signedUserOp: { sender: '0x1' },
            } as unknown as SignedSpendArtifact,
            { coordinatorAddress: OLD_COORD, mixedSpendContract }
        )

    /** Mirrors both call sites: same terms, fresh artifact, one bounded retry. */
    function submitWithRecovery<T>(
        artifact: SignedSpendArtifact,
        submit: (candidate: SignedSpendArtifact) => Promise<T>,
        resign: () => Promise<SignedSpendArtifact>,
        recoverOpts?: { lockExpiresAt?: number }
    ) {
        const { result, unmount } = renderHook(
            () => ({ recover: useSignedSpendRecovery(), repair: useRainControllerRepair() }),
            { wrapper }
        )
        // Lets a test simulate the user leaving mid-recovery.
        leaveScreen = unmount
        return submitSignedSpend(artifact, submit, {
            onFailure: (failure) => void result.current.repair({ strategy: artifact.strategy, error: failure }),
            recover: (failure, candidate) => result.current.recover(failure, candidate, resign, recoverOpts),
        })
    }
    let leaveScreen: () => void = () => {}

    const controllerChanged = new ApiError('Rain controller changed', {
        status: 409,
        code: API_ERROR_CODES.RAIN_CONTROLLER_CHANGED,
    })
    const revertedBody = { error: 'Failed to broadcast UserOp', code: API_ERROR_CODES.USER_OP_REVERTED }

    it('RAIN_CONTROLLER_CHANGED: re-signs once with a FRESH prep and the same lock, then succeeds', async () => {
        const submit = jest.fn(async (candidate: SignedSpendArtifact) => {
            if (candidate === first) throw controllerChanged
            return { status: 'COMPLETED' }
        })
        const first = collateralArtifact('prep-1')
        const replacement = collateralArtifact('prep-2', NEW_COORD)

        await expect(submitWithRecovery(first, submit, async () => replacement)).resolves.toEqual({
            status: 'COMPLETED',
        })

        expect(submit).toHaveBeenCalledTimes(2)
        expect(submit.mock.calls[1][0]).toBe(replacement)
        // The backend already proved the rotation — no controller read here.
        expect(mockRefreshController).not.toHaveBeenCalled()
        // The backend already failed that intent; a cancel would only be
        // refused and never touches Rain's signature state.
        expect(mockCancelPreparation).not.toHaveBeenCalled()
    })

    // Both definitive backend outcomes qualify: a confirmed on-chain revert and
    // a bundler validation rejection. Nothing was executed in either case.
    it.each([
        ['USER_OP_REVERTED', API_ERROR_CODES.USER_OP_REVERTED],
        ['USER_OP_REJECTED', API_ERROR_CODES.USER_OP_REJECTED],
    ])('modern mixed + %s + moved controller: one replacement submission', async (_label, code) => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        const first = mixedArtifact('prep-1', 'broadcast-first-revert-v1')
        const replacement = mixedArtifact('prep-2', 'broadcast-first-revert-v1')
        const submit = jest.fn(async (candidate: SignedSpendArtifact) =>
            candidate === first ? { error: 'Failed to broadcast UserOp', code } : { status: 'COMPLETED' }
        )

        await expect(submitWithRecovery(first, submit, async () => replacement)).resolves.toEqual({
            status: 'COMPLETED',
        })
        expect(submit).toHaveBeenCalledTimes(2)
        expect(mockRefreshController).toHaveBeenCalledTimes(1)
    })

    it('a USER_OP_REJECTED on a legacy mixed artifact is still never replayed', async () => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        const body = { error: 'rejected', code: API_ERROR_CODES.USER_OP_REJECTED }
        const submit = jest.fn(async () => body)
        const resign = jest.fn()
        await expect(submitWithRecovery(mixedArtifact('prep-1'), submit, resign)).resolves.toBe(body)
        expect(resign).not.toHaveBeenCalled()
    })

    it('a confirmed revert whose controller did NOT move is not replayed', async () => {
        // Someone else already refreshed, so `changed` is meaningless — only the
        // address comparison proves a rotation.
        mockRefreshController.mockResolvedValue({ coordinatorAddress: OLD_COORD, changed: true })
        const first = mixedArtifact('prep-1', 'broadcast-first-revert-v1')
        const submit = jest.fn(async () => revertedBody)
        const resign = jest.fn()

        await expect(submitWithRecovery(first, submit, resign)).resolves.toBe(revertedBody)
        expect(submit).toHaveBeenCalledTimes(1)
        expect(resign).not.toHaveBeenCalled()
    })

    it.each([undefined, 'broadcast-after'])('legacy mixed capability %s never replays a revert', async (capability) => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        const submit = jest.fn(async () => revertedBody)
        const resign = jest.fn()

        await expect(submitWithRecovery(mixedArtifact('prep-1', capability), submit, resign)).resolves.toBe(
            revertedBody
        )
        expect(submit).toHaveBeenCalledTimes(1)
        expect(resign).not.toHaveBeenCalled()
        // Only the late cache-only repair runs — it never re-signs or re-submits.
        expect(mockRefreshController).toHaveBeenCalledTimes(1)
    })

    it('a second failure after recovery stops there and keeps the final outcome', async () => {
        const submit = jest.fn(async () => {
            throw controllerChanged
        })
        const first = collateralArtifact('prep-1')

        await expect(submitWithRecovery(first, submit, async () => collateralArtifact('prep-2'))).rejects.toBe(
            controllerChanged
        )
        expect(submit).toHaveBeenCalledTimes(2)
    })

    it.each([
        ['an unknown transport failure', new Error('Failed to fetch')],
        ['a receipt timeout', new Error('UserOp receipt timeout - transaction may still be pending')],
    ])('%s is never replayed', async (_label, failure) => {
        const submit = jest.fn(async () => {
            throw failure
        })
        const resign = jest.fn()
        await expect(submitWithRecovery(collateralArtifact('prep-1'), submit, resign)).rejects.toBe(failure)
        expect(submit).toHaveBeenCalledTimes(1)
        expect(resign).not.toHaveBeenCalled()
    })

    it('pending and successful responses never re-sign or repair', async () => {
        const resign = jest.fn()
        const pending = { status: 'PENDING' }
        await expect(
            submitWithRecovery(mixedArtifact('prep-1', 'broadcast-first-revert-v1'), async () => pending, resign)
        ).resolves.toBe(pending)
        expect(resign).not.toHaveBeenCalled()
        expect(mockRefreshController).not.toHaveBeenCalled()
    })

    it('a dismissed re-sign surfaces the typed ABORT (not a payment failure) and submits nothing more', async () => {
        const cancelled = Object.assign(new Error('ceremony dismissed'), { name: 'NotAllowedError' })
        const submit = jest.fn(async () => {
            throw controllerChanged
        })
        const outcome = await submitWithRecovery(collateralArtifact('prep-1'), submit, async () => {
            throw cancelled
        }).catch((e) => e)

        expect(outcome).toBeInstanceOf(SpendRecoveryAbortedError)
        // The original failure stays attached for diagnostics.
        expect((outcome as SpendRecoveryAbortedError).cause).toBe(controllerChanged)
        expect(submit).toHaveBeenCalledTimes(1)
    })

    it('a cooldown that cannot fit the lock surfaces the typed QUOTE REVIEW outcome', async () => {
        const submit = jest.fn(async () => {
            throw controllerChanged
        })
        const outcome = await submitWithRecovery(
            collateralArtifact('prep-1'),
            submit,
            async () => {
                throw new RainCooldownError('cooling down', 600)
            },
            // Lock dies in 60s; a 600s cooldown cannot fit.
            { lockExpiresAt: Date.now() + 60_000 }
        ).catch((e) => e)

        expect(outcome).toBeInstanceOf(SpendRecoveryQuoteReviewError)
        expect(submit).toHaveBeenCalledTimes(1)
    })

    /*
     * fitsLock === true: the re-sign hits Rain's cooldown, but the wait plus
     * signing still fits inside the ORIGINAL lock — so the recovery waits it
     * out itself and submits the replacement under that same lock. No quote
     * renewal, no second confirmation.
     */
    it('waits out a cooldown that fits the lock, then submits the replacement under the SAME lock', async () => {
        jest.useFakeTimers({ advanceTimers: true })
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        const first = mixedArtifact('prep-1', 'broadcast-first-revert-v1')
        const replacement = mixedArtifact('prep-2', 'broadcast-first-revert-v1')
        const resign = jest
            .fn<Promise<SignedSpendArtifact>, []>()
            .mockRejectedValueOnce(new RainCooldownError('cooling down', 2))
            .mockResolvedValueOnce(replacement)
        const submit = jest.fn(async (candidate: SignedSpendArtifact) =>
            candidate === first
                ? // Definitive no-effect rejection from the backend.
                  { error: 'rejected', code: API_ERROR_CODES.USER_OP_REJECTED }
                : { status: 'COMPLETED' }
        )

        const settled = submitWithRecovery(first, submit, resign, { lockExpiresAt: Date.now() + 120_000 })
        await waitFor(() => expect(resign).toHaveBeenCalledTimes(1))
        // Still cooling down: nothing else has been submitted.
        expect(submit).toHaveBeenCalledTimes(1)

        await act(async () => {
            await jest.advanceTimersByTimeAsync(2_100)
        })

        await expect(settled).resolves.toEqual({ status: 'COMPLETED' })
        expect(resign).toHaveBeenCalledTimes(2)
        // Exactly one replacement submission, and the callback received the
        // REPLACEMENT artifact — the caller builds its body from that, so the
        // lock it carries is the one the caller already holds.
        expect(submit).toHaveBeenCalledTimes(2)
        expect(submit.mock.calls[0][0]).toBe(first)
        expect(submit.mock.calls[1][0]).toBe(replacement)
        jest.useRealTimers()
    }, 20_000)

    it('leaving mid-wait aborts the recovery and submits nothing more', async () => {
        jest.useFakeTimers({ advanceTimers: true })
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        const first = mixedArtifact('prep-1', 'broadcast-first-revert-v1')
        const resign = jest
            .fn<Promise<SignedSpendArtifact>, []>()
            .mockRejectedValueOnce(new RainCooldownError('cooling down', 2))
            .mockResolvedValueOnce(mixedArtifact('prep-2', 'broadcast-first-revert-v1'))
        const submit = jest.fn(async () => ({ error: 'rejected', code: API_ERROR_CODES.USER_OP_REJECTED }))

        const settled = submitWithRecovery(first, submit, resign, { lockExpiresAt: Date.now() + 120_000 }).catch(
            (e) => e
        )
        await waitFor(() => expect(resign).toHaveBeenCalledTimes(1))
        leaveScreen()
        await act(async () => {
            await jest.advanceTimersByTimeAsync(2_100)
        })

        expect(await settled).toBeInstanceOf(SpendRecoveryAbortedError)
        expect(resign).toHaveBeenCalledTimes(1)
        expect(submit).toHaveBeenCalledTimes(1)
        jest.useRealTimers()
    }, 20_000)

    it('an UNEXPECTED recovery error keeps the ORIGINAL outcome', async () => {
        const submit = jest.fn(async () => {
            throw controllerChanged
        })
        await expect(
            submitWithRecovery(collateralArtifact('prep-1'), submit, async () => {
                throw new Error('re-sign blew up')
            })
        ).rejects.toBe(controllerChanged)
        expect(submit).toHaveBeenCalledTimes(1)
    })

    // Error TEXT can never prove the absence of side effects: only a structured
    // code from the backend may start a fresh payment.
    it.each([
        ['a message-only revert', { message: 'USER_OP_REVERTED: signed operation reverted on-chain' }],
        ['an error-field revert with no code', { error: 'USER_OP_REVERTED: reverted' }],
        ['a code that rides on a PENDING outcome', { code: API_ERROR_CODES.USER_OP_REVERTED, status: 'PENDING' }],
        ['a code that rides on a successful outcome', { code: API_ERROR_CODES.USER_OP_REVERTED, success: true }],
    ])('%s never triggers a replacement payment', async (_label, body) => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        const submit = jest.fn(async () => body)
        const resign = jest.fn()

        await expect(
            submitWithRecovery(mixedArtifact('prep-1', 'broadcast-first-revert-v1'), submit, resign)
        ).resolves.toBe(body)
        expect(submit).toHaveBeenCalledTimes(1)
        expect(resign).not.toHaveBeenCalled()
    })

    it('submits the REPLACEMENT artifact itself, never the failed one', async () => {
        const failure = new ApiError('Operation failed', { status: 500, code: API_ERROR_CODES.USER_OP_REVERTED })
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        const first = mixedArtifact('prep-1', 'broadcast-first-revert-v1')
        const replacement = mixedArtifact('prep-2', 'broadcast-first-revert-v1')
        const submit = jest.fn(async (candidate: SignedSpendArtifact) => {
            if (candidate === first) throw failure
            return { status: 'COMPLETED' }
        })

        await submitWithRecovery(first, submit, async () => replacement)

        expect(submit.mock.calls[0][0]).toBe(first)
        expect(submit.mock.calls[1][0]).toBe(replacement)
    })

    /*
     * Leaving the screen has to stop the recovery at EVERY boundary, not only
     * inside a cooldown sleep: a controller read or a re-sign that resolves
     * afterwards must not hand back an artifact the caller would submit.
     */
    it('a controller refresh that resolves AFTER the user leaves submits nothing', async () => {
        let releaseRefresh: (value: { coordinatorAddress: string; changed: boolean }) => void = () => {}
        mockRefreshController.mockReturnValueOnce(
            new Promise((resolve) => {
                releaseRefresh = resolve
            })
        )
        const body = { error: 'Failed to broadcast UserOp', code: API_ERROR_CODES.USER_OP_REVERTED }
        const submit = jest.fn(async () => body)
        const resign = jest.fn()

        const settled = submitWithRecovery(mixedArtifact('prep-1', 'broadcast-first-revert-v1'), submit, resign).catch(
            (e) => e
        )
        await waitFor(() => expect(mockRefreshController).toHaveBeenCalledTimes(1))
        leaveScreen()
        releaseRefresh({ coordinatorAddress: NEW_COORD, changed: true })

        expect(await settled).toBeInstanceOf(SpendRecoveryAbortedError)
        expect(resign).not.toHaveBeenCalled()
        expect(submit).toHaveBeenCalledTimes(1)
    })

    it('a re-sign that resolves AFTER the user leaves is never submitted', async () => {
        mockRefreshController.mockResolvedValue({ coordinatorAddress: NEW_COORD, changed: true })
        let releaseResign: (artifact: SignedSpendArtifact) => void = () => {}
        const resign = jest.fn(
            () =>
                new Promise<SignedSpendArtifact>((resolve) => {
                    releaseResign = resolve
                })
        )
        const body = { error: 'Failed to broadcast UserOp', code: API_ERROR_CODES.USER_OP_REVERTED }
        const submit = jest.fn(async () => body)

        const settled = submitWithRecovery(mixedArtifact('prep-1', 'broadcast-first-revert-v1'), submit, resign).catch(
            (e) => e
        )
        await waitFor(() => expect(resign).toHaveBeenCalledTimes(1))
        leaveScreen()
        releaseResign(mixedArtifact('prep-2', 'broadcast-first-revert-v1'))

        expect(await settled).toBeInstanceOf(SpendRecoveryAbortedError)
        // Only the ORIGINAL submission ever happened.
        expect(submit).toHaveBeenCalledTimes(1)
    })

    it('an artifact with no Rain metadata (smart-only) is never replayed', async () => {
        const submit = jest.fn(async () => {
            throw controllerChanged
        })
        const resign = jest.fn()
        const artifact = { strategy: 'smart-only' } as unknown as SignedSpendArtifact
        await expect(submitWithRecovery(artifact, submit, resign)).rejects.toBe(controllerChanged)
        expect(submit).toHaveBeenCalledTimes(1)
        expect(resign).not.toHaveBeenCalled()
    })
})
