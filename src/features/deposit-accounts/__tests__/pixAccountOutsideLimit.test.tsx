import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { depositAccountCounts } from '@/features/attention/journeyState'
import { shareBankDetails } from '@/features/attention/registry'
import { countsTowardAccountLimit } from '../rails'
import { useDepositAccounts } from '../useDepositAccounts'
import type { DepositAccount } from '../types'
import type { DepositAccountsSnapshot } from '@/services/deposit-accounts'

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ userId: 'user-a' }) }))
const fetchDepositAccounts = jest.fn()
jest.mock('@/services/deposit-accounts', () => ({
    fetchDepositAccounts: (...args: unknown[]) => fetchDepositAccounts(...args),
    claimDepositAccount: jest.fn(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        capabilities: { rails: [], nextActions: [], restrictions: [], routes: [] },
        gateFor: () => ({ kind: 'ready' }),
        rails: [],
        isLoading: false,
    }),
}))

const account = (railId: string, currency: string): DepositAccount =>
    ({
        id: `account-${currency}`,
        railId,
        country: 'BRA',
        currency,
        status: 'active',
        isPrimary: true,
        matching: { nameOnAccount: 'user', sender: 'business-only' },
        rules: {},
        instructions: { accountHolderName: 'Ana Souza', paymentRails: [] },
    }) as unknown as DepositAccount
const PIX = account('bridge.pix_br', 'BRL')
const EUR = account('bridge.sepa_eu', 'EUR')
const snapshot = (accounts: DepositAccount[], accountsHeld?: number): DepositAccountsSnapshot => ({
    accounts,
    claimable: [],
    unavailable: [],
    accountLimit: 2,
    accountsHeld,
})

const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
    </QueryClientProvider>
)

// Aleks, 2026-11-13: the Pix account is not one of the user's two bank accounts; the API's cap follows it
describe('the Pix account and the account limit', () => {
    it('is the one rail outside the limit', () => {
        expect(countsTowardAccountLimit('bridge.pix_br')).toBe(false)
        expect(countsTowardAccountLimit('bridge.sepa_eu')).toBe(true)
        expect(countsTowardAccountLimit('bridge.unknown_rail')).toBe(false)
    })

    it('leaves Home with no bank details to share when the Pix account is all the user holds', () => {
        expect(depositAccountCounts(snapshot([PIX])).active).toBe(0)
        expect(depositAccountCounts(snapshot([PIX, EUR])).active).toBe(1)
        const state = (active: number) =>
            ({
                userId: 'user-a',
                userLoaded: true,
                bankDepositReceived: false,
                depositAccounts: { enabled: true, loaded: true, active, claimable: 0 },
            }) as unknown as Parameters<typeof shareBankDetails.eligible>[0]
        expect(shareBankDetails.eligible(state(depositAccountCounts(snapshot([PIX])).active))).toBe('ineligible')
        expect(shareBankDetails.eligible(state(depositAccountCounts(snapshot([PIX, EUR])).active))).toBe('show')
    })

    it('counts the slots without the Pix account on an API that sends no count', async () => {
        fetchDepositAccounts.mockResolvedValue(snapshot([PIX, EUR]))
        const { result } = renderHook(() => useDepositAccounts(), { wrapper })
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.slotsHeld).toBe(1)
    })

    it("prints the API's own count where it sends one, never a count of its own", async () => {
        // an API from before the ruling still counts the Pix account: the app prints what it says
        fetchDepositAccounts.mockResolvedValue(snapshot([PIX, EUR], 2))
        const { result } = renderHook(() => useDepositAccounts(), { wrapper })
        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.slotsHeld).toBe(2)
    })
})
