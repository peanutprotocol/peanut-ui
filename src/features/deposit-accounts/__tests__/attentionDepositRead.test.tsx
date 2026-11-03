import { useAttentionDepositAccounts } from '@/features/attention/journeyState'
import posthog from 'posthog-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useDepositAccounts } from '../useDepositAccounts'
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
        capabilities: { rails: userRails, nextActions: [], restrictions: [] },
        gateFor: (_op: string, scope?: GateScope) =>
            (scope?.railId && gatesByRailId[scope.railId]) || ({ kind: 'needs-enrollment' } as GateState),
        rails: userRails,
        isLoading: false,
    }),
}))

const bankRail = (id: string, method: string): RailCapability =>
    ({ id, method, channel: 'bank', status: 'enabled' }) as RailCapability

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

test('one shared review transition emits one approval with two consumers', async () => {
    resolveAccounts([], [{ ...CLAIMABLE_USD_PREVIEW, blockedBy: 'endorsement-pending' }])
    const view = renderHook(
        () => ({ manager: useAttentionDepositAccounts('user-a', true), hub: useDepositAccounts() }),
        { wrapper }
    )
    await waitFor(() => expect(view.result.current.manager.data?.claimable[0]?.blockedBy).toBe('endorsement-pending'))
    resolveAccounts([], [CLAIMABLE_USD_PREVIEW])
    await act(async () => {
        await view.result.current.manager.refetch()
    })
    await waitFor(() => expect(view.result.current.hub.claimable.ACH_US?.blockedBy).not.toBe('endorsement-pending'))
    expect(posthog.capture).toHaveBeenCalledTimes(1)
})

test('the manager alone never polls an unfinished review', async () => {
    jest.useFakeTimers()
    try {
        resolveAccounts([], [{ ...CLAIMABLE_USD_PREVIEW, blockedBy: 'endorsement-pending' }])
        const view = renderHook(() => useAttentionDepositAccounts('user-a', true), { wrapper })
        await act(async () => {})
        await act(async () => {
            jest.advanceTimersByTime(60_000)
        })
        expect(fetchDepositAccounts).toHaveBeenCalledTimes(1)
        view.unmount()
    } finally {
        jest.useRealTimers()
    }
})

import { depositAccountCounts } from '@/features/attention/journeyState'
test.each([false, true])(
    'a provisioning primary replaces old active details regardless of response order: %s',
    (reverse) => {
        const base: DepositAccount = {
            id: 'old',
            railId: 'bridge.sepa_eu',
            country: 'DEU',
            currency: 'EUR',
            status: 'active',
            isPrimary: false,
            matching: { nameOnAccount: 'user', sender: 'unknown' },
            instructions: { iban: 'test', accountHolderName: 'Test', paymentRails: ['sepa'] },
        }
        const accounts = [base, { ...base, id: 'new', status: 'provisioning' as const, isPrimary: true }]
        expect(
            depositAccountCounts({ accounts: reverse ? accounts.reverse() : accounts, claimable: [], unavailable: [] })
                .active
        ).toBe(0)
    }
)
