/**
 * Pure-function tests for the spend-routing primitives in `spendPreflight`
 * (shared by useSpendBundle and useSignSpendBundle).
 *
 * The hooks orchestrate kernel clients, Rain API calls, and the
 * session-key grant flow — those paths are covered by integration + manual
 * testing on sandbox. These tests lock down the deterministic pieces:
 *   - `computeSpendStrategy` routing (smart → collateral → mixed → insufficient)
 *   - `usdcUnitsToRainCents` amount conversion at the Rain API boundary
 */

// Mock the ZeroDev imports so Jest doesn't try to parse their ESM.
// The pure functions we're testing don't touch any of this at runtime.
jest.mock('@zerodev/permissions', () => ({}))
jest.mock('@zerodev/permissions/policies', () => ({}))
jest.mock('@zerodev/permissions/signers', () => ({}))
jest.mock('@zerodev/sdk', () => ({}))
jest.mock('@zerodev/sdk/constants', () => ({}))
jest.mock('@/context/kernelClient.context', () => ({ useKernelClient: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: jest.fn() }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: jest.fn(),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('../useGrantSessionKey', () => ({ useGrantSessionKey: jest.fn() }))
jest.mock('@/services/rain', () => ({ rainApi: {} }))
const mockReadContract = jest.fn()
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: { readContract: mockReadContract } }))

// Mock constants so the module can resolve token decimals during import.
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 137 },
    PEANUT_WALLET_TOKEN: '0x1234567890123456789012345678901234567890',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))
// The token constants moved to their own module so consumers don't pull viem's
// chain registry; useBalance reads them from there now.
jest.mock('@/constants/wallet-token.consts', () => ({
    PEANUT_WALLET_TOKEN: '0x1234567890123456789012345678901234567890',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
    PEANUT_WALLET_TOKEN_SYMBOL: 'USDC',
    USE_SEPOLIA: false,
}))
jest.mock('@/constants/rain.consts', () => ({
    rainCoordinatorAbi: [],
    rainWithdrawEip712Types: {},
    RAIN_WITHDRAW_EIP712_DOMAIN_NAME: 'Collateral',
    RAIN_WITHDRAW_EIP712_DOMAIN_VERSION: '2',
}))

import {
    computeSpendStrategy,
    ensureCurrentControllerApproval,
    ensurePreparedControllerApproval,
    fetchLiveSmartUsdcBalance,
    isUserCancellation,
    RainControllerCheckError,
    runCollateralSpendPreflight,
    SessionKeyGrantRequiredError,
} from '../spendPreflight'
import { SpendRecoveryAbortedError } from '../signSpendRetry'
import type { GrantSessionKeyError } from '../useGrantSessionKey'
import type { RainCardOverview } from '@/services/rain'

describe('computeSpendStrategy', () => {
    const amount = 1000n

    it('prefers smart-only when smart covers the amount, even if collateral-only is allowed', () => {
        // Smart account is spent first so the payment never touches the Rain
        // collateral (and its per-account withdrawal-signature cooldown) when
        // smart-account USDC already covers it.
        expect(computeSpendStrategy({ smart: 5000n, rain: 10_000n, amount, collateralOnlyAllowed: true })).toBe(
            'smart-only'
        )
    })

    it('uses collateral-only when smart cannot cover but collateral can (allowed)', () => {
        expect(computeSpendStrategy({ smart: 100n, rain: 10_000n, amount, collateralOnlyAllowed: true })).toBe(
            'collateral-only'
        )
    })

    it('falls back to smart-only when collateral-only is not allowed', () => {
        expect(computeSpendStrategy({ smart: 5000n, rain: 10_000n, amount, collateralOnlyAllowed: false })).toBe(
            'smart-only'
        )
    })

    it('prefers smart-only when collateral alone cannot cover (even with collateral-only allowed)', () => {
        expect(computeSpendStrategy({ smart: 5000n, rain: 500n, amount, collateralOnlyAllowed: true })).toBe(
            'smart-only'
        )
    })

    it('returns mixed when neither bucket alone covers but the sum does', () => {
        expect(computeSpendStrategy({ smart: 400n, rain: 700n, amount, collateralOnlyAllowed: true })).toBe('mixed')
    })

    it('returns insufficient when the total spendable is below the amount', () => {
        expect(computeSpendStrategy({ smart: 100n, rain: 200n, amount, collateralOnlyAllowed: true })).toBe(
            'insufficient'
        )
    })

    it('handles exact-match at the boundary as collateral-only (>=)', () => {
        expect(computeSpendStrategy({ smart: 0n, rain: amount, amount, collateralOnlyAllowed: true })).toBe(
            'collateral-only'
        )
    })

    it('handles exact-match at the boundary as smart-only when rain disallowed', () => {
        expect(computeSpendStrategy({ smart: amount, rain: 0n, amount, collateralOnlyAllowed: false })).toBe(
            'smart-only'
        )
    })
})

describe('fetchLiveSmartUsdcBalance', () => {
    beforeEach(() => mockReadContract.mockReset())

    // A queryClient stand-in whose fetchQuery just runs the provided queryFn —
    // exercises the real `smartUsdcBalanceQueryOptions` (the shared balance
    // query) so we prove routing reads it through the cache, not a second
    // readContract.
    const makeQueryClient = () =>
        ({
            fetchQuery: jest.fn(async (opts: { queryFn: () => Promise<bigint> }) => opts.queryFn()),
        }) as unknown as import('@tanstack/react-query').QueryClient

    // Routing reads this live (force-refetch, not the 30s-cached useBalance
    // value) so a smart account that's been swept empty into collateral can't be
    // mis-routed to `smart-only` and revert on-chain (incident #2230).
    it('reads the live on-chain USDC balanceOf the given sender via the shared query', async () => {
        mockReadContract.mockResolvedValue(0n)
        const queryClient = makeQueryClient()
        const sender = '0x959e088a09f61ab01cb83b0ebcc74b2cf6d62053'
        const balance = await fetchLiveSmartUsdcBalance(queryClient, sender)

        expect(balance).toBe(0n)
        expect(mockReadContract).toHaveBeenCalledTimes(1)
        expect(mockReadContract).toHaveBeenCalledWith(
            expect.objectContaining({
                address: '0x1234567890123456789012345678901234567890', // mocked PEANUT_WALLET_TOKEN
                functionName: 'balanceOf',
                args: [sender],
            })
        )
    })

    it('force-refetches the shared balance query (staleTime 0) keyed on the sender', async () => {
        mockReadContract.mockResolvedValue(0n)
        const queryClient = makeQueryClient()
        const sender = '0x959e088a09f61ab01cb83b0ebcc74b2cf6d62053'
        await fetchLiveSmartUsdcBalance(queryClient, sender)

        // staleTime:0 = ignore the 30s display cache and read chain now; same
        // ['balance', sender] key so the displayed balance refreshes too.
        expect(queryClient.fetchQuery).toHaveBeenCalledWith(
            expect.objectContaining({ staleTime: 0, queryKey: ['balance', sender] })
        )
    })

    it('returns the on-chain balance unchanged when funds are present', async () => {
        mockReadContract.mockResolvedValue(5_000_000n)
        expect(await fetchLiveSmartUsdcBalance(makeQueryClient(), '0xabc0000000000000000000000000000000000001')).toBe(
            5_000_000n
        )
    })
})

/**
 * The collateral-only grant gate, run AFTER /prepare: the prep states which
 * coordinator the withdrawal targets, and a cached overview can be behind it
 * (TASK-22734).
 */
describe('ensurePreparedControllerApproval', () => {
    const COORD_A = '0xAAAA000000000000000000000000000000000001'
    const COORD_B = '0xbbbb000000000000000000000000000000000002'
    const overviewWith = (coordinatorAddress: string, hasWithdrawApproval: boolean) =>
        ({
            status: { coordinatorAddress },
            cards: [{ id: 'card-1', status: 'ACTIVE', hasWithdrawApproval }],
        }) as unknown as RainCardOverview

    const run = async (opts: { cached: RainCardOverview | undefined; fresh?: RainCardOverview; prepared: string }) => {
        const refetchOverview = jest.fn(async () => opts.fresh)
        const grant = jest.fn(async () => ({ ok: true }) as const)
        await ensurePreparedControllerApproval({
            preparedCoordinator: opts.prepared,
            overview: opts.cached,
            refetchOverview,
            grant,
        })
        return { refetchOverview, grant }
    }

    it('short-circuits when the cached overview already matches the prepared coordinator', async () => {
        // Case-insensitive: the wire casing of the two sides need not agree.
        const cached = overviewWith(COORD_A, true)
        const { refetchOverview, grant } = await run({ cached, prepared: COORD_A.toLowerCase() })
        expect(refetchOverview).not.toHaveBeenCalled()
        expect(grant).not.toHaveBeenCalled()
    })

    it('re-grants once when the prepared coordinator moved and the refetch confirms the dead approval', async () => {
        const onGrantRequired = jest.fn()
        const refetchOverview = jest.fn(async () => overviewWith(COORD_B, false))
        const grant = jest.fn(async () => ({ ok: true }) as const)
        await ensurePreparedControllerApproval({
            preparedCoordinator: COORD_B,
            overview: overviewWith(COORD_A, true),
            refetchOverview,
            grant,
            onGrantRequired,
        })
        expect(refetchOverview).toHaveBeenCalledTimes(1)
        expect(onGrantRequired).toHaveBeenCalledTimes(1)
        expect(grant).toHaveBeenCalledTimes(1)
    })

    it('does not grant when the refetched overview still reports a live approval', async () => {
        // e.g. the pre-prepare gate just granted; the cached snapshot is behind.
        const cached = overviewWith(COORD_A, false)
        const fresh = overviewWith(COORD_B, true)
        const { grant, refetchOverview } = await run({ cached, fresh, prepared: COORD_B })
        expect(refetchOverview).toHaveBeenCalledTimes(1)
        expect(grant).not.toHaveBeenCalled()
    })

    it('does nothing when no active card is visible', async () => {
        const cached = { cards: [] } as unknown as RainCardOverview
        const { refetchOverview, grant } = await run({ cached, prepared: COORD_B })
        expect(refetchOverview).not.toHaveBeenCalled()
        expect(grant).not.toHaveBeenCalled()
    })

    it('surfaces a cancelled grant as SessionKeyGrantRequiredError so the caller never signs', async () => {
        await expect(
            ensurePreparedControllerApproval({
                preparedCoordinator: COORD_B,
                overview: overviewWith(COORD_A, true),
                refetchOverview: async () => overviewWith(COORD_B, false),
                grant: async () => ({ ok: false, error: { kind: 'user-cancelled' } }) as const,
            })
        ).rejects.toBeInstanceOf(SessionKeyGrantRequiredError)
    })
})

/**
 * The pre-prepare controller gate (TASK-22734 hotfix): one backend controller
 * read before anything is prepared, an overview refetch when that read is not
 * what the cached snapshot was taken against, and a renewal of the approval
 * only when the spend needs it or the stored one is outdated. Fails closed on
 * any read it cannot complete; cancellation and unmount are typed control flow.
 */
describe('ensureCurrentControllerApproval', () => {
    const COORD_A = '0xAAAA000000000000000000000000000000000001'
    const COORD_B = '0xbbbb000000000000000000000000000000000002'
    type Strategy = 'collateral-only' | 'mixed' | 'smart-only'
    const overviewWith = (coordinatorAddress: string, hasWithdrawApproval: boolean, stored?: boolean) =>
        ({
            status: { coordinatorAddress },
            cards: [
                {
                    id: 'card-1',
                    status: 'ACTIVE',
                    hasWithdrawApproval,
                    ...(stored === undefined ? {} : { hasStoredWithdrawApproval: stored }),
                },
            ],
        }) as unknown as RainCardOverview

    type GrantOutcome = { ok: true } | { ok: false; error: GrantSessionKeyError }
    const harness = (opts: {
        strategy: Strategy
        cached: RainCardOverview | undefined
        refreshed?: Array<{ coordinatorAddress: string; changed: boolean } | Error>
        fresh?: Array<RainCardOverview | undefined | Error>
        grants?: GrantOutcome[]
        gone?: boolean[]
    }) => {
        const refreshQueue = [...(opts.refreshed ?? [])]
        const freshQueue = [...(opts.fresh ?? [])]
        const grantQueue = [...(opts.grants ?? [{ ok: true } as const])]
        const goneQueue = [...(opts.gone ?? [])]
        const refreshController = jest.fn(async () => {
            const next = refreshQueue.shift()
            if (next instanceof Error) throw next
            return next ?? { coordinatorAddress: COORD_A, changed: false }
        })
        const refetchOverview = jest.fn(async () => {
            const next = freshQueue.shift()
            if (next instanceof Error) throw next
            return next
        })
        const grant = jest.fn(async () => grantQueue.shift() ?? ({ ok: true } as const))
        const onGrantRequired = jest.fn()
        const isGone = jest.fn(() => goneQueue.shift() ?? false)
        const run = () =>
            ensureCurrentControllerApproval({
                strategy: opts.strategy,
                overview: opts.cached,
                refreshController,
                refetchOverview,
                grant,
                onGrantRequired,
                isGone,
            })
        return { run, refreshController, refetchOverview, grant, onGrantRequired }
    }

    it('smart-only never reads anything', async () => {
        const h = harness({ strategy: 'smart-only', cached: overviewWith(COORD_A, true, true) })
        await expect(h.run()).resolves.toEqual({ overview: overviewWith(COORD_A, true, true), granted: false })
        expect(h.refreshController).not.toHaveBeenCalled()
        expect(h.grant).not.toHaveBeenCalled()
    })

    it('no visible card: nothing to check or renew', async () => {
        const h = harness({ strategy: 'collateral-only', cached: { cards: [] } as unknown as RainCardOverview })
        await h.run()
        expect(h.refreshController).not.toHaveBeenCalled()
    })

    it('current controller + live cached approval: one read, no refetch, no grant, controller marked approved', async () => {
        const cached = overviewWith(COORD_A, true, true)
        const h = harness({
            strategy: 'collateral-only',
            cached,
            refreshed: [{ coordinatorAddress: COORD_A, changed: false }],
        })
        await expect(h.run()).resolves.toEqual({ overview: cached, approvedCoordinator: COORD_A, granted: false })
        expect(h.refetchOverview).not.toHaveBeenCalled()
        expect(h.grant).not.toHaveBeenCalled()
    })

    it('a "changed" read invalidates the cached snapshot even when it names the same controller', async () => {
        const fresh = overviewWith(COORD_A, true, true)
        const h = harness({
            strategy: 'collateral-only',
            cached: overviewWith(COORD_A, true, true),
            refreshed: [{ coordinatorAddress: COORD_A, changed: true }],
            fresh: [fresh],
        })
        await expect(h.run()).resolves.toEqual({ overview: fresh, approvedCoordinator: COORD_A, granted: false })
        expect(h.refetchOverview).toHaveBeenCalledTimes(1)
        expect(h.grant).not.toHaveBeenCalled()
    })

    it.each<Strategy>(['collateral-only', 'mixed'])(
        '%s: old→new controller with a stored grant renews it once (grant before the prepare it authorizes)',
        async (strategy) => {
            const fresh = overviewWith(COORD_B, false, true)
            const h = harness({
                strategy,
                cached: overviewWith(COORD_A, true, true),
                refreshed: [{ coordinatorAddress: COORD_B, changed: true }],
                fresh: [fresh],
            })
            await expect(h.run()).resolves.toEqual({ overview: fresh, approvedCoordinator: COORD_B, granted: true })
            expect(h.refreshController).toHaveBeenCalledTimes(1)
            expect(h.refetchOverview).toHaveBeenCalledTimes(1)
            expect(h.onGrantRequired).toHaveBeenCalledTimes(1)
            expect(h.grant).toHaveBeenCalledTimes(1)
        }
    )

    it('mixed: cached snapshot already false on the current controller but a grant IS stored → renews', async () => {
        const cached = overviewWith(COORD_B, false, true)
        const h = harness({
            strategy: 'mixed',
            cached,
            refreshed: [{ coordinatorAddress: COORD_B, changed: false }],
            fresh: [cached],
        })
        await expect(h.run()).resolves.toMatchObject({ approvedCoordinator: COORD_B, granted: true })
        expect(h.grant).toHaveBeenCalledTimes(1)
    })

    it('mixed: never granted (nothing stored) → no prompt, spend proceeds', async () => {
        const fresh = overviewWith(COORD_B, false, false)
        const h = harness({
            strategy: 'mixed',
            cached: overviewWith(COORD_A, false, false),
            refreshed: [{ coordinatorAddress: COORD_B, changed: true }],
            fresh: [fresh],
        })
        await expect(h.run()).resolves.toEqual({ overview: fresh, granted: false })
        expect(h.grant).not.toHaveBeenCalled()
    })

    it('collateral-only: never granted still needs the approval → grants', async () => {
        const fresh = overviewWith(COORD_A, false, false)
        const h = harness({
            strategy: 'collateral-only',
            cached: overviewWith(COORD_A, false, false),
            refreshed: [{ coordinatorAddress: COORD_A, changed: false }],
            fresh: [fresh],
        })
        await expect(h.run()).resolves.toMatchObject({ granted: true })
    })

    describe('older backend without the stored flag', () => {
        it('mixed, not rotated, cached false → no prompt', async () => {
            const cached = overviewWith(COORD_A, false)
            const h = harness({
                strategy: 'mixed',
                cached,
                refreshed: [{ coordinatorAddress: COORD_A, changed: false }],
                fresh: [cached],
            })
            await expect(h.run()).resolves.toEqual({ overview: cached, granted: false })
            expect(h.grant).not.toHaveBeenCalled()
        })

        it('mixed, rotated, cached approval was live → the rotation killed it → renews', async () => {
            const fresh = overviewWith(COORD_B, false)
            const h = harness({
                strategy: 'mixed',
                cached: overviewWith(COORD_A, true),
                refreshed: [{ coordinatorAddress: COORD_B, changed: true }],
                fresh: [fresh],
            })
            await expect(h.run()).resolves.toMatchObject({ granted: true })
        })
    })

    it('another device already renewed: the fresh snapshot covers the current controller → no grant', async () => {
        const fresh = overviewWith(COORD_B, true, true)
        const h = harness({
            strategy: 'collateral-only',
            cached: overviewWith(COORD_A, true, true),
            refreshed: [{ coordinatorAddress: COORD_B, changed: true }],
            fresh: [fresh],
        })
        await expect(h.run()).resolves.toEqual({ overview: fresh, approvedCoordinator: COORD_B, granted: false })
        expect(h.grant).not.toHaveBeenCalled()
    })

    it('a controller read that fails is fail-closed: no refetch, no grant', async () => {
        const cause = new Error('provider down')
        const h = harness({
            strategy: 'collateral-only',
            cached: overviewWith(COORD_A, true, true),
            refreshed: [cause],
        })
        const error = await h.run().catch((e) => e)
        expect(error).toBeInstanceOf(RainControllerCheckError)
        expect(error.step).toBe('controller')
        expect(error.cause).toBe(cause)
        expect(h.refetchOverview).not.toHaveBeenCalled()
        expect(h.grant).not.toHaveBeenCalled()
    })

    it.each([
        ['rejects', new Error('overview down')],
        ['resolves without data', undefined],
    ])('an overview refetch that %s after a rotation is fail-closed: no grant', async (_label, outcome) => {
        const h = harness({
            strategy: 'mixed',
            cached: overviewWith(COORD_A, true, true),
            refreshed: [{ coordinatorAddress: COORD_B, changed: true }],
            fresh: [outcome],
        })
        const error = await h.run().catch((e) => e)
        expect(error).toBeInstanceOf(RainControllerCheckError)
        expect(error.step).toBe('overview')
        expect(h.grant).not.toHaveBeenCalled()
    })

    it('a dismissed prompt is typed control flow carrying the cancellation', async () => {
        const h = harness({
            strategy: 'collateral-only',
            cached: overviewWith(COORD_A, true, true),
            refreshed: [{ coordinatorAddress: COORD_B, changed: true }],
            fresh: [overviewWith(COORD_B, false, true)],
            grants: [{ ok: false, error: { kind: 'user-cancelled' } }],
        })
        const error = await h.run().catch((e) => e)
        expect(error).toBeInstanceOf(SpendRecoveryAbortedError)
        expect(isUserCancellation(error.cause)).toBe(true)
    })

    it('an unexpected grant failure surfaces as SessionKeyGrantRequiredError', async () => {
        const h = harness({
            strategy: 'collateral-only',
            cached: overviewWith(COORD_A, false, false),
            fresh: [overviewWith(COORD_A, false, false)],
            grants: [{ ok: false, error: { kind: 'unexpected', message: 'boom' } }],
        })
        await expect(h.run()).rejects.toBeInstanceOf(SessionKeyGrantRequiredError)
    })

    describe('leaving the screen', () => {
        it('after the controller read: no refetch, no prompt', async () => {
            const h = harness({
                strategy: 'collateral-only',
                cached: overviewWith(COORD_A, true, true),
                refreshed: [{ coordinatorAddress: COORD_B, changed: true }],
                gone: [true],
            })
            await expect(h.run()).rejects.toBeInstanceOf(SpendRecoveryAbortedError)
            expect(h.refetchOverview).not.toHaveBeenCalled()
            expect(h.grant).not.toHaveBeenCalled()
        })

        it('after the refetch: no prompt', async () => {
            const h = harness({
                strategy: 'collateral-only',
                cached: overviewWith(COORD_A, true, true),
                refreshed: [{ coordinatorAddress: COORD_B, changed: true }],
                fresh: [overviewWith(COORD_B, false, true)],
                gone: [false, true],
            })
            await expect(h.run()).rejects.toBeInstanceOf(SpendRecoveryAbortedError)
            expect(h.grant).not.toHaveBeenCalled()
        })

        it('after a SUCCESSFUL grant: the caller still prepares nothing', async () => {
            const h = harness({
                strategy: 'collateral-only',
                cached: overviewWith(COORD_A, true, true),
                refreshed: [{ coordinatorAddress: COORD_B, changed: true }],
                fresh: [overviewWith(COORD_B, false, true)],
                gone: [false, false, true],
            })
            await expect(h.run()).rejects.toBeInstanceOf(SpendRecoveryAbortedError)
            expect(h.grant).toHaveBeenCalledTimes(1)
        })
    })

    describe('the store refuses a stale approval (controller moved again while saving)', () => {
        const COORD_C = '0xcccc000000000000000000000000000000000003'

        it('ONE bounded pre-prepare round: re-read, refetch, grant again', async () => {
            const freshC = overviewWith(COORD_C, false, true)
            const h = harness({
                strategy: 'collateral-only',
                cached: overviewWith(COORD_A, true, true),
                refreshed: [
                    { coordinatorAddress: COORD_B, changed: true },
                    { coordinatorAddress: COORD_C, changed: true },
                ],
                fresh: [overviewWith(COORD_B, false, true), freshC],
                grants: [{ ok: false, error: { kind: 'stale-approval', message: 'outdated' } }, { ok: true }],
            })
            await expect(h.run()).resolves.toEqual({ overview: freshC, approvedCoordinator: COORD_C, granted: true })
            expect(h.refreshController).toHaveBeenCalledTimes(2)
            expect(h.refetchOverview).toHaveBeenCalledTimes(2)
            expect(h.grant).toHaveBeenCalledTimes(2)
        })

        it('a second refusal fails closed — no third round', async () => {
            const h = harness({
                strategy: 'collateral-only',
                cached: overviewWith(COORD_A, true, true),
                refreshed: [
                    { coordinatorAddress: COORD_B, changed: true },
                    { coordinatorAddress: COORD_C, changed: true },
                ],
                fresh: [overviewWith(COORD_B, false, true), overviewWith(COORD_C, false, true)],
                grants: [
                    { ok: false, error: { kind: 'stale-approval', message: 'outdated' } },
                    { ok: false, error: { kind: 'stale-approval', message: 'outdated again' } },
                ],
            })
            const error = await h.run().catch((e) => e)
            expect(error).toBeInstanceOf(SessionKeyGrantRequiredError)
            expect(error.cause.kind).toBe('stale-approval')
            expect(h.grant).toHaveBeenCalledTimes(2)
        })
    })
})

// ── shared collateral pre-flight orchestration ──────────────────────────────
// The one ordered sequence both spend engines run before signing anything:
// migration gate + overview validation. Drift between the engines here is
// exactly how the migration-ordering bug shipped twice. The session-key grant
// is NOT here — it binds to the coordinator /prepare returns, so it lives in
// `ensurePreparedControllerApproval` above.

const CARD_OVERVIEW = (hasWithdrawApproval: boolean) =>
    ({ cards: [{ status: 'ACTIVE', hasWithdrawApproval }] }) as never

const preflightHarness = (opts: { account: unknown; overview?: unknown }) => {
    const rebuilt = { account: { address: '0xrebuilt' } }
    const sendNoopUserOp = jest.fn(async () => ({ receipt: { status: 'success' } as never }))
    const rebuildClient = jest.fn(async () => rebuilt)
    const overlayStates: boolean[] = []
    return {
        args: {
            kind: 'CRYPTO_WITHDRAW',
            kernelClient: { account: opts.account },
            overview: (opts.overview ?? CARD_OVERVIEW(true)) as never,
            requireOverview: false,
            sendNoopUserOp,
            rebuildClient,
            setSecurityOverlay: (open: boolean) => overlayStates.push(open),
            migrationTrigger: 'mixed-spend' as const,
        },
        sendNoopUserOp,
        rebuildClient,
        rebuilt,
        overlayStates,
    }
}

const unmigratedWrapper = () => {
    // flips to migrated once the (mocked) migration op lands — mirrors chain state
    let calls = 0
    return {
        address: '0x70f22a4db066aed9bcd2157a7b19e2e28c10c483',
        getRootValidatorMigrationStatus: jest.fn(async () => ++calls > 1),
    }
}

describe('runCollateralSpendPreflight', () => {
    it('smart-only: no migration, same client back', async () => {
        const h = preflightHarness({ account: unmigratedWrapper(), overview: CARD_OVERVIEW(false) })
        const result = await runCollateralSpendPreflight({ ...h.args, strategy: 'smart-only' })
        expect(result).toBe(h.args.kernelClient)
        expect(h.sendNoopUserOp).not.toHaveBeenCalled()
    })

    it('mixed + unmigrated wrapper: migrates under the overlay, returns rebuilt client', async () => {
        const h = preflightHarness({ account: unmigratedWrapper(), overview: CARD_OVERVIEW(false) })
        const result = await runCollateralSpendPreflight({ ...h.args, strategy: 'mixed' })
        expect(h.sendNoopUserOp).toHaveBeenCalledTimes(1)
        expect(h.rebuildClient).toHaveBeenCalledTimes(1)
        expect(result).toBe(h.rebuilt)
        expect(h.overlayStates).toEqual([true, false]) // overlay opened then always closed
    })

    it('mixed + plain (patched) account: zero migration behavior', async () => {
        const h = preflightHarness({ account: { address: '0xplain' } })
        const result = await runCollateralSpendPreflight({ ...h.args, strategy: 'mixed' })
        expect(result).toBe(h.args.kernelClient)
        expect(h.sendNoopUserOp).not.toHaveBeenCalled()
        expect(h.rebuildClient).not.toHaveBeenCalled()
        expect(h.overlayStates).toEqual([])
    })

    it('collateral-only: never migrates (pre-migration state still verifies the sig)', async () => {
        const h = preflightHarness({ account: unmigratedWrapper() })
        const result = await runCollateralSpendPreflight({ ...h.args, strategy: 'collateral-only' })
        expect(result).toBe(h.args.kernelClient)
        expect(h.sendNoopUserOp).not.toHaveBeenCalled()
    })

    it('requireOverview: fails closed when the overview has not loaded (sign-only engine)', async () => {
        const h = preflightHarness({ account: { address: '0xplain' }, overview: undefined })
        await expect(
            runCollateralSpendPreflight({
                ...h.args,
                overview: undefined as never,
                requireOverview: true,
                strategy: 'collateral-only',
            })
        ).rejects.toThrow(SessionKeyGrantRequiredError)
    })

    it('broadcasting engine proceeds without overview (no card visible → nothing to grant)', async () => {
        const h = preflightHarness({ account: { address: '0xplain' }, overview: undefined })
        const result = await runCollateralSpendPreflight({
            ...h.args,
            overview: undefined as never,
            requireOverview: false,
            strategy: 'collateral-only',
        })
        expect(result).toBe(h.args.kernelClient)
    })
})
