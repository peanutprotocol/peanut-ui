import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MAX_PROVISIONING_POLLS, PROVISIONING_POLL_MS, useDepositAccounts } from '../useDepositAccounts'
import type { DepositAccount } from '../types'
import type { GateScope, GateState } from '@/utils/capability-gate'

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
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        gateFor: (_op: string, scope?: GateScope) =>
            (scope?.railId && gatesByRailId[scope.railId]) || ({ kind: 'needs-enrollment' } as GateState),
    }),
}))

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

const wrapper = ({ children }: { children: ReactNode }) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
    jest.clearAllMocks()
    gatesByRailId = {}
})

describe('useDepositAccounts', () => {
    it('maps each returned account onto its corridor', async () => {
        fetchDepositAccounts.mockResolvedValue([account(), account({ id: 'b', railId: 'bridge.ach_us' })])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.accounts.SEPA_EU?.id).toBe('a')
        expect(result.current.accounts.ACH_US?.id).toBe('b')
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
        fetchDepositAccounts.mockResolvedValue([
            account({ id: 'new', isPrimary: true }),
            account({ id: 'old', isPrimary: false, status: 'retiring' }),
        ])

        const { result } = renderHook(() => useDepositAccounts(), { wrapper })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.accounts.SEPA_EU?.id).toBe('new')
    })

    it('asks the gate one rail at a time, so a working corridor cannot unlock a blocked one', async () => {
        gatesByRailId = { 'bridge.ach_us': { kind: 'ready' } }
        fetchDepositAccounts.mockResolvedValue([])

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
        fetchDepositAccounts.mockResolvedValue([])
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
        fetchDepositAccounts.mockResolvedValue([account({ status: 'provisioning' })])

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

    it('keeps polling while the account is still within its budget', async () => {
        fetchDepositAccounts.mockResolvedValue([account({ status: 'provisioning' })])

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
