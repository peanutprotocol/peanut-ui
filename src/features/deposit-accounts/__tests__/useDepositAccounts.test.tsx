import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
    ENDORSEMENT_POLL_MS,
    MAX_PROVISIONING_POLLS,
    PROVISIONING_POLL_MS,
    useDepositAccounts,
} from '../useDepositAccounts'
import { CLAIMABLE_USD_PREVIEW } from '../__fixtures__/railPolicy'
import type { ClaimableCorridor, DepositAccount } from '../types'
import type { RailCapability } from '@/types/capabilities'
import type { GateScope, GateState } from '@/utils/capability-gate'

let mockUserId: string | undefined = 'user-a'
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ userId: mockUserId }) }))

const fetchDepositAccounts = jest.fn()
const claimDepositAccount = jest.fn()
jest.mock('@/services/deposit-accounts', () => ({
    fetchDepositAccounts: (...args: unknown[]) => fetchDepositAccounts(...args),
    claimDepositAccount: (...args: unknown[]) => claimDepositAccount(...args),
}))

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

// the capability block, expressed the way the gate is actually asked: one
// answer per rail id, so a test can enable one corridor and block the rest
let gatesByRailId: Record<string, GateState> = {}
// the rails the capability block names — what the corridor rows are built from
let userRails: RailCapability[] = []
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        gateFor: (_op: string, scope?: GateScope) =>
            (scope?.railId && gatesByRailId[scope.railId]) || ({ kind: 'needs-enrollment' } as GateState),
        rails: userRails,
        isLoading: false,
    }),
}))

const bankRail = (id: string, method: string): RailCapability =>
    ({ id, method, channel: 'bank', status: 'enabled' }) as RailCapability

const account = (over: Partial<DepositAccount> = {}): DepositAccount => ({
    id: 'a',
    railId: 'bridge.sepa_eu',
    country: 'DEU',
    currency: 'EUR',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: 'unknown' },
    instructions: { accountHolderName: 'Ana Pérez', iban: 'DE00', paymentRails: ['sepa'] },
    ...over,
})

/**
 * One read answers both halves: what the user holds, and the terms of the
 * corridors they could still open. Most tests only care about the first.
 */
const resolveAccounts = (accounts: DepositAccount[], claimable: ClaimableCorridor[] = []) =>
    fetchDepositAccounts.mockResolvedValue({ accounts, claimable })

const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
    jest.clearAllMocks()
    mockUserId = 'user-a'
    gatesByRailId = {}
    userRails = [bankRail('bridge.sepa_eu', 'SEPA_EU'), bankRail('bridge.ach_us', 'ACH_US')]
})

describe('useDepositAccounts', () => {
    /**
     * The corridor rows used to come from a local table, so every user read an
     * unavailable ARS row. They come from the user's own rails now.
     */
    it('offers the corridors the user has a rail for, and no others', async () => {
        userRails = [bankRail('manteca.bank_transfer_ar', 'BANK_TRANSFER_AR'), bankRail('manteca.pix_br', 'PIX_BR')]
        resolveAccounts([])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.corridors).toEqual(['PIX_BR', 'BANK_TRANSFER_AR'])
    })

    /**
     * A withheld corridor is a corridor the backend named, so it gets a row
     * that says it is not available — and being withheld is often exactly why
     * it has no rail. The hub keeps no catalogue fallback that would carry it.
     */
    it('keeps a corridor the backend withholds, rail or no rail', async () => {
        userRails = [bankRail('bridge.sepa_eu', 'SEPA_EU')]
        fetchDepositAccounts.mockResolvedValue({
            accounts: [],
            claimable: [],
            unavailable: [
                {
                    railId: 'bridge.bank_transfer_co',
                    method: 'BANK_TRANSFER_CO',
                    country: 'CO',
                    currency: 'COP',
                    reason: 'not-offered',
                },
            ],
        })

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.corridors).toContain('BANK_TRANSFER_CO')
        expect(result.current.unavailable.BANK_TRANSFER_CO?.reason).toBe('not-offered')
    })

    /**
     * The backend's cap counts every account the provider bills for. One
     * corridor holds two of them during a rotation, and a revoked one is free,
     * so the count comes from the rows and never from one-per-corridor.
     */
    it('counts slots the way the cap does: every live row, and no revoked one', async () => {
        resolveAccounts([
            account({ id: 'new', isPrimary: true }),
            account({ id: 'old', isPrimary: false, status: 'retiring' }),
            account({ id: 'usd', railId: 'bridge.ach_us', status: 'provisioning' }),
            account({ id: 'dead', railId: 'bridge.spei_mx', status: 'revoked' }),
        ])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.slotsHeld).toBe(3)
    })

    it('prefers the backend count and limit where it sends them', async () => {
        fetchDepositAccounts.mockResolvedValue({
            accounts: [account()],
            claimable: [],
            accountLimit: 5,
            // a provisioning row the provider never opened is listed and not counted
            accountsHeld: 0,
        })

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.accountLimit).toBe(5)
        expect(result.current.slotsHeld).toBe(0)
    })

    it('sends no limit on an API that predates it', async () => {
        resolveAccounts([account()])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.accountLimit).toBeUndefined()
        expect(result.current.slotsHeld).toBe(1)
    })

    /**
     * A rail that leaves the catalogue disappears from the capability block and
     * leaves the account standing — the accounts endpoint keeps it on purpose.
     * Reading the rails alone dropped the row, and the details a payer may
     * still be using with it.
     */
    it('keeps a corridor the user holds an account on after its rail leaves the catalogue', async () => {
        userRails = [bankRail('bridge.ach_us', 'ACH_US')]
        resolveAccounts([account({ railId: 'bridge.sepa_eu' })], [CLAIMABLE_USD_PREVIEW])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.corridors).toEqual(['SEPA_EU', 'ACH_US'])
        expect(result.current.accounts.SEPA_EU?.id).toBe('a')
        // no rail means no gate, so the corridor reads its details and offers
        // no claim
        expect(result.current.gates.SEPA_EU.kind).toBe('needs-enrollment')
    })

    it('does not offer an enabled rail the API excludes from virtual-account claims', async () => {
        userRails = [bankRail('bridge.ach_us', 'ACH_US'), bankRail('bridge.spei_mx', 'SPEI_MX')]
        gatesByRailId = { 'bridge.ach_us': { kind: 'ready' }, 'bridge.spei_mx': { kind: 'ready' } }
        resolveAccounts([], [CLAIMABLE_USD_PREVIEW])
        const { result } = renderHook(() => useDepositAccounts(), { wrapper })
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.corridors).toEqual(['ACH_US'])
    })

    it('offers no corridor to a user with no bank rail', async () => {
        userRails = []
        resolveAccounts([])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.corridors).toEqual([])
    })

    it('maps each returned account onto its corridor', async () => {
        resolveAccounts([account(), account({ id: 'b', railId: 'bridge.ach_us' })])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.accounts.SEPA_EU?.id).toBe('a')
        expect(result.current.accounts.ACH_US?.id).toBe('b')
    })

    it('maps each previewed corridor onto its corridor, and leaves the rest empty', async () => {
        resolveAccounts([], [CLAIMABLE_USD_PREVIEW])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.claimable.ACH_US).toEqual(CLAIMABLE_USD_PREVIEW)
        expect(result.current.claimable.SEPA_EU).toBeUndefined()
    })

    /** an API that predates the preview says nothing, and nothing is invented */
    it('previews no terms when the read carries none', async () => {
        resolveAccounts([])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.claimable.ACH_US).toBeUndefined()
    })

    /**
     * A failed read used to be indistinguishable from holding no accounts: the
     * fallback map is all-undefined either way, and the list then invited the
     * user to claim an account they may already have.
     */
    it('reports a failed read rather than an empty account list', async () => {
        fetchDepositAccounts.mockRejectedValue(new Error('502'))

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.accounts.SEPA_EU).toBeUndefined()
    })

    /**
     * A provider rotation returns the new account AND the one it replaces. The
     * old reduction kept whichever arrived last, so response order could put
     * retired details in front of a payer.
     */
    it('shows the primary account, whatever order the retiring one arrives in', async () => {
        resolveAccounts([
            account({ id: 'new', isPrimary: true }),
            account({ id: 'old', isPrimary: false, status: 'retiring' }),
        ])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.accounts.SEPA_EU?.id).toBe('new')
    })

    it('asks the gate one rail at a time, so a working corridor cannot unlock a blocked one', async () => {
        gatesByRailId = { 'bridge.ach_us': { kind: 'ready' } }
        resolveAccounts([])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.gates.ACH_US.kind).toBe('ready')
        expect(result.current.gates.SEPA_EU.kind).toBe('needs-enrollment')
    })

    /**
     * The claim error used to be a single global string, so a failed EUR claim
     * greeted the user on the USD claim screen before USD had been tried.
     */
    it('keeps a claim failure on the corridor that produced it', async () => {
        resolveAccounts([])
        claimDepositAccount.mockRejectedValue(new Error('Could not open the account'))

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => result.current.claim('SEPA_EU'))
        await waitFor(() => expect(result.current.claimError?.corridor).toBe('SEPA_EU'))

        // a fresh attempt elsewhere clears the old corridor's news
        claimDepositAccount.mockResolvedValue(account({ railId: 'bridge.ach_us' }))
        act(() => result.current.claim('ACH_US'))
        await waitFor(() => expect(result.current.claimError).toBeUndefined())
    })
})

/**
 * A provisioning account used to poll every 5s for as long as the screen was
 * open — on a phone, forever, for an account the provider had stopped working
 * on. The wait now has a budget, and what it runs out into is the one state
 * with a retry on it.
 */
describe('useDepositAccounts caps the provisioning poll', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('marks the corridor timed out once the budget is spent, and stops asking', async () => {
        resolveAccounts([account({ status: 'provisioning' })])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })
        await waitFor(() => expect(result.current.accounts.SEPA_EU?.status).toBe('provisioning'))

        // the poll's own clock: every tick is one answer that still said
        // provisioning, so the budget is spent in MAX_PROVISIONING_POLLS ticks
        for (let i = 0; i < MAX_PROVISIONING_POLLS; i++) {
            await act(async () => {
                jest.advanceTimersByTime(PROVISIONING_POLL_MS)
            })
        }

        // the provider never said the account failed, so the wire status
        // stands and the timeout is the client's own answer beside it
        await waitFor(() => expect(result.current.accounts.SEPA_EU?.timedOut).toBe(true))
        expect(result.current.accounts.SEPA_EU?.status).toBe('provisioning')
        const callsAtTimeout = fetchDepositAccounts.mock.calls.length
        await act(async () => {
            jest.advanceTimersByTime(PROVISIONING_POLL_MS * 5)
        })
        expect(fetchDepositAccounts).toHaveBeenCalledTimes(callsAtTimeout)
    })

    /**
     * The budget used to be one global counter, so an account that started
     * waiting late inherited whatever an older one had already spent — and a
     * second claim handed the older one a fresh wait it had not earned.
     */
    it('gives each account its own budget', async () => {
        resolveAccounts([account({ status: 'provisioning' })])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })
        await waitFor(() => expect(result.current.accounts.SEPA_EU?.status).toBe('provisioning'))

        // the EUR account spends all but one poll of its budget alone
        for (let i = 0; i < MAX_PROVISIONING_POLLS - 2; i++) {
            await act(async () => {
                jest.advanceTimersByTime(PROVISIONING_POLL_MS)
            })
        }
        // a second corridor starts provisioning now
        resolveAccounts([
            account({ status: 'provisioning' }),
            account({ id: 'b', railId: 'bridge.ach_us', status: 'provisioning' }),
        ])
        for (let i = 0; i < 2; i++) {
            await act(async () => {
                jest.advanceTimersByTime(PROVISIONING_POLL_MS)
            })
        }

        await waitFor(() => expect(result.current.accounts.SEPA_EU?.timedOut).toBe(true))
        expect(result.current.accounts.ACH_US?.timedOut).toBeUndefined()
    })

    it('restarts only the retried account budget when an idempotent claim returns the same id', async () => {
        const euro = account({ status: 'provisioning' })
        resolveAccounts([euro, account({ id: 'b', railId: 'bridge.ach_us', status: 'provisioning' })])
        claimDepositAccount.mockResolvedValue(euro)
        const { result } = renderHook(() => useDepositAccounts(), { wrapper })
        await waitFor(() => expect(result.current.accounts.SEPA_EU?.status).toBe('provisioning'))
        for (let i = 0; i < MAX_PROVISIONING_POLLS; i++) {
            await act(async () => {
                jest.advanceTimersByTime(PROVISIONING_POLL_MS)
            })
        }
        expect(result.current.accounts.SEPA_EU?.timedOut).toBe(true)
        expect(result.current.accounts.ACH_US?.timedOut).toBe(true)
        await act(async () => {
            result.current.claim('SEPA_EU')
        })
        await waitFor(() => expect(result.current.claimingCorridor).toBeUndefined())
        expect(result.current.accounts.SEPA_EU?.timedOut).toBeUndefined()
        expect(result.current.accounts.ACH_US?.timedOut).toBe(true)
        const calls = fetchDepositAccounts.mock.calls.length
        await act(async () => {
            jest.advanceTimersByTime(PROVISIONING_POLL_MS)
        })
        expect(fetchDepositAccounts.mock.calls.length).toBeGreaterThan(calls)
    })

    it('keeps polling while the account is still within its budget', async () => {
        resolveAccounts([account({ status: 'provisioning' })])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })
        await waitFor(() => expect(result.current.accounts.SEPA_EU?.status).toBe('provisioning'))

        const before = fetchDepositAccounts.mock.calls.length
        await act(async () => {
            jest.advanceTimersByTime(PROVISIONING_POLL_MS)
        })
        expect(fetchDepositAccounts.mock.calls.length).toBeGreaterThan(before)
        expect(result.current.accounts.SEPA_EU?.status).toBe('provisioning')
    })
})

/**
 * The claim route carries a server-side rollout gate. A user outside the
 * rollout is refused there whatever the client-side flag says, and that is not
 * a failure they can retry their way out of — so the screen has to know the
 * difference between "we could not open it" and "this is not open to you yet".
 */
describe('useDepositAccounts on a refused claim', () => {
    class FakeApiError extends Error {
        readonly status: number
        readonly code: string | undefined
        constructor(message: string, status: number, code?: string) {
            super(message)
            this.name = 'ApiError'
            this.status = status
            this.code = code
        }
    }

    const refusals: Array<[string, FakeApiError]> = [
        // the rollout gate on the claim route names itself
        ['403 DEPOSIT_ACCOUNTS_NOT_AVAILABLE', new FakeApiError('not enabled', 403, 'DEPOSIT_ACCOUNTS_NOT_AVAILABLE')],
        // no provider customer, or no rail for this corridor
        ['404', new FakeApiError('no rail', 404)],
    ]

    it.each(refusals)('reads a %s as not available yet, never as a failure to retry', async (_name, error) => {
        resolveAccounts([])
        claimDepositAccount.mockRejectedValue(error)

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => result.current.claim('SEPA_EU'))
        await waitFor(() => expect(result.current.claimError?.corridor).toBe('SEPA_EU'))
        expect(result.current.claimError?.unavailable).toBe(true)
    })

    /**
     * A 403 the deposit gate did not write is a different refusal — an expired
     * session, most often. Relabelling it "not available to you yet" sends the
     * user to wait for a rollout instead of signing in again.
     */
    it('leaves a 403 from anything but the deposit gate retryable', async () => {
        resolveAccounts([])
        claimDepositAccount.mockRejectedValue(new FakeApiError('Forbidden', 403))

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => result.current.claim('SEPA_EU'))
        await waitFor(() => expect(result.current.claimError?.corridor).toBe('SEPA_EU'))
        expect(result.current.claimError?.unavailable).toBe(false)
    })

    it('keeps an ordinary failure retryable', async () => {
        resolveAccounts([])
        claimDepositAccount.mockRejectedValue(new FakeApiError('Could not open the account', 500))

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        act(() => result.current.claim('SEPA_EU'))
        await waitFor(() => expect(result.current.claimError?.corridor).toBe('SEPA_EU'))
        expect(result.current.claimError?.unavailable).toBe(false)
    })
})

describe('deposit-account cache isolation', () => {
    const sharedWrapper = () => {
        const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })
        return function SharedQueryClient({ children }: { children: ReactNode }) {
            return <QueryClientProvider client={client}>{children}</QueryClientProvider>
        }
    }

    it('keeps bank instructions separate across two logins sharing one QueryClient', async () => {
        resolveAccounts([account({ id: 'account-a' })])
        const { result, rerender } = renderHook(() => useDepositAccounts(), { wrapper: sharedWrapper() })
        await waitFor(() => expect(result.current.accounts.SEPA_EU?.id).toBe('account-a'))

        mockUserId = undefined
        rerender()
        expect(result.current.accounts.SEPA_EU).toBeUndefined()
        expect(fetchDepositAccounts).toHaveBeenCalledTimes(1)

        resolveAccounts([account({ id: 'account-b' })])
        mockUserId = 'user-b'
        rerender()
        expect(result.current.accounts.SEPA_EU).toBeUndefined()
        await waitFor(() => expect(result.current.accounts.SEPA_EU?.id).toBe('account-b'))
        expect(fetchDepositAccounts).toHaveBeenCalledTimes(2)

        mockUserId = 'user-a'
        rerender()
        expect(result.current.accounts.SEPA_EU?.id).toBe('account-a')
        expect(fetchDepositAccounts).toHaveBeenCalledTimes(2)
    })

    it('does not expose a late account response to the next login', async () => {
        let finishFirst!: (value: { accounts: DepositAccount[]; claimable: ClaimableCorridor[] }) => void
        fetchDepositAccounts.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    finishFirst = resolve
                })
        )
        resolveAccounts([account({ id: 'account-b' })])
        const { result, rerender } = renderHook(() => useDepositAccounts(), { wrapper: sharedWrapper() })
        await waitFor(() => expect(fetchDepositAccounts).toHaveBeenCalledTimes(1))

        mockUserId = 'user-b'
        rerender()
        await waitFor(() => expect(result.current.accounts.SEPA_EU?.id).toBe('account-b'))
        await act(async () => {
            finishFirst({ accounts: [account({ id: 'account-a' })], claimable: [] })
        })
        expect(result.current.accounts.SEPA_EU?.id).toBe('account-b')
    })

    // A claim on a corridor whose level the user has not done answers with the
    // action that opens it. The hook hands the corridor to the caller, which
    // starts that verification; nothing is recorded as a failure.
    it('hands a verification_required claim to the caller, with its corridor', async () => {
        resolveAccounts([])
        claimDepositAccount.mockResolvedValue({
            outcome: 'verification_required',
            nextAction: { key: 'verify-corridor:bank_transfer_co', kind: 'sumsub', purpose: 'x', levelKey: 'bridge' },
        })
        const onVerificationRequired = jest.fn()

        const { result } = renderHook(() => useDepositAccounts({ onVerificationRequired }), { wrapper })
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        act(() => result.current.claim('BANK_TRANSFER_CO'))

        await waitFor(() => expect(onVerificationRequired).toHaveBeenCalledWith('BANK_TRANSFER_CO'))
        expect(result.current.claimError).toBeUndefined()
    })
})

/*
 * TASK-23054: a corridor held by the user's own review reads "Under review",
 * and its wait drawer says the page updates by itself. The read keeps going
 * while the review is under way, and stops once the answer changes.
 */
describe('useDepositAccounts while the user own review is under way', () => {
    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    const underReview = {
        railId: 'bridge.ach_us',
        method: 'ACH_US',
        country: 'US',
        currency: 'USD',
        reason: 'not-offered',
        cause: 'review-pending',
    }

    it('re-reads the accounts until the review answers', async () => {
        fetchDepositAccounts.mockResolvedValue({ accounts: [], claimable: [], unavailable: [underReview] })

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })
        await waitFor(() => expect(result.current.unavailable.ACH_US?.cause).toBe('review-pending'))

        // the reviewer approves: the corridor is offered now
        fetchDepositAccounts.mockResolvedValue({ accounts: [], claimable: [CLAIMABLE_USD_PREVIEW], unavailable: [] })
        await act(async () => {
            jest.advanceTimersByTime(ENDORSEMENT_POLL_MS)
        })
        await waitFor(() => expect(result.current.claimable.ACH_US).toBeDefined())
        expect(result.current.unavailable.ACH_US).toBeUndefined()

        // nothing is under way any more, so the read stops
        const calls = fetchDepositAccounts.mock.calls.length
        await act(async () => {
            jest.advanceTimersByTime(ENDORSEMENT_POLL_MS * 3)
        })
        expect(fetchDepositAccounts).toHaveBeenCalledTimes(calls)
    })
})
