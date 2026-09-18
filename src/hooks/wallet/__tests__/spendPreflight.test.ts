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
    ensurePreparedControllerApproval,
    fetchLiveSmartUsdcBalance,
    runCollateralSpendPreflight,
    SessionKeyGrantRequiredError,
} from '../spendPreflight'
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
