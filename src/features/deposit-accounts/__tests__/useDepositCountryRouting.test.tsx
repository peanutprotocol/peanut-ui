/**
 * @jest-environment jsdom
 */
/**
 * Where a country leads, from the one screen that offers every way in.
 *
 * The rail catalogue decides, not this hook: a corridor the user is offered
 * opens the account screens in place, a corridor nobody can hold follows its
 * own top-up route, and a country with neither keeps the bank flow that works
 * today. The cases below are the four answers a user can get.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
}))

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...args: any[]) => mockCapture(...args) } }))

jest.mock('@/features/destinations/country-rails', () => ({
    soleLiveRailForCountry: (id: string) =>
        ({
            AR: { id: 'bank-transfer-add', path: '/add-money/argentina/manteca' },
            DE: { id: 'bank-transfer-add', path: '/add-money/germany/bank' },
        })[id] ?? null,
    liveRailsForCountry: (id: string) =>
        id === 'DEU' ? [{ id: 'bank-transfer-add', path: '/add-money/germany/bank' }] : [],
}))

jest.mock('@/utils/native-routes', () => ({
    addMoneyCountryUrl: (path: string) => `/add-money/${path}`,
    rewriteMethodPath: (path: string) => path,
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: { DEPOSIT_METHOD_SELECTED: 'deposit_method_selected' },
}))

// the corridor resolver and the rail catalogue are the code under test — only
// the two answers that come from the user are mocked
const mockDepositAccountsEnabled = jest.fn(() => true)
jest.mock('../useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => mockDepositAccountsEnabled(),
}))

const mockOfferedCorridors = jest.fn(() => [] as string[])
jest.mock('../useOfferedCorridors', () => ({
    useOfferedCorridors: () => mockOfferedCorridors(),
}))

import { useDepositCountryRouting } from '../useDepositCountryRouting'

const PORTUGAL = { id: 'PRT', type: 'country', title: 'Portugal', path: 'portugal', iso2: 'PT', currency: 'EUR' }
const ARGENTINA = { id: 'AR', type: 'country', title: 'Argentina', path: 'argentina', iso2: 'AR', currency: 'ARS' }
const BRAZIL = { id: 'BRA', type: 'country', title: 'Brazil', path: 'brazil', iso2: 'BR', currency: 'BRL' }
// a euro member whose own bank flow is live — the mock answers for DEU alone
const GERMANY = { id: 'DEU', type: 'country', title: 'Germany', path: 'germany', iso2: 'DE', currency: 'EUR' }
const NIGERIA = { id: 'NG', type: 'country', title: 'Nigeria', path: 'nigeria', iso2: 'NG', currency: 'NGN' }

type RoutingArgs = Parameters<typeof useDepositCountryRouting>[0]

const renderRouting = (onUrlUpdate?: (e: UrlUpdateEvent) => void, args?: RoutingArgs) =>
    renderHook(() => useDepositCountryRouting(args), {
        wrapper: withNuqsTestingAdapter({ searchParams: '', onUrlUpdate }),
    })

/** the corridor terms the backend returns, with the block it carries */
const blocked = (blockedBy?: string) =>
    ({ SEPA_EU: { railId: 'bridge.sepa_eu', blockedBy } }) as unknown as NonNullable<RoutingArgs>['claimable']

beforeEach(() => {
    jest.clearAllMocks()
    mockDepositAccountsEnabled.mockReturnValue(true)
    mockOfferedCorridors.mockReturnValue([])
})

describe('useDepositCountryRouting', () => {
    it('sends a euro-zone country to the one euro account, in place', async () => {
        mockOfferedCorridors.mockReturnValue(['SEPA_EU'])
        const updates: UrlUpdateEvent[] = []
        const { result } = renderRouting((e) => updates.push(e))

        act(() => result.current.openCountry(PORTUGAL as any))

        // nuqs queues its url writes, so the recorded state arrives a tick later
        await waitFor(() => expect(updates.at(-1)?.searchParams.get('corridor')).toBe('SEPA_EU'))
        expect(updates.at(-1)?.searchParams.get('step')).toBe('details')
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(mockCapture).toHaveBeenCalledWith('deposit_method_selected', {
            method_type: 'bank',
            country: 'portugal',
        })
    })

    // Argentina has no account to open: the provider mints a CVU per deposit,
    // so both entry points land on the top-up flow, residence or not.
    it('sends Argentina to the route its own rail names', () => {
        const { result } = renderRouting()

        act(() => result.current.openCountry(ARGENTINA as any))

        // from DEPOSIT_RAILS.BANK_TRANSFER_AR.topUpHref, not a second copy of it
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/argentina/manteca')
    })

    // Brazil has one bank way in, the Pix top-up, so the country pick goes
    // straight to it like Argentina.
    it('sends Brazil to the Pix top-up', () => {
        const { result } = renderRouting()

        act(() => result.current.openCountry(BRAZIL as any))

        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/brazil/manteca')
    })

    it('keeps the bank flow for a corridor the user has no rail for, and while the flag is off', () => {
        const { result } = renderRouting()
        act(() => result.current.openCountry({ id: 'DE', type: 'country', path: 'germany' } as any))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/germany/bank')

        mockRouterPush.mockClear()
        mockDepositAccountsEnabled.mockReturnValue(false)
        mockOfferedCorridors.mockReturnValue(['SEPA_EU'])
        const { result: dark } = renderRouting()
        act(() => dark.current.openCountry({ id: 'DE', type: 'country', path: 'germany' } as any))
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/germany/bank')
    })

    /**
     * The regression this branch exists for. The user IS offered the euro
     * corridor, so "one country, one destination" answered with the standing
     * account and dropped the country's own bank flow from the routes — and at
     * the account cap there is no standing account to open, so the tap led
     * nowhere. The transfer they send themselves needs no account and was
     * working the whole time.
     */
    it('sends a capped user to the transfer that needs no account', () => {
        mockOfferedCorridors.mockReturnValue(['SEPA_EU'])
        const updates: UrlUpdateEvent[] = []
        const { result } = renderRouting((e) => updates.push(e), { claimable: blocked('account-limit') })

        act(() => result.current.openCountry(GERMANY as any))

        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/germany/bank')
        expect(updates.at(-1)?.searchParams.get('corridor')).not.toBe('SEPA_EU')
    })

    it.each([['endorsement-required'], ['endorsement-pending']])(
        'sends a user blocked by %s to the same transfer',
        (blockedBy) => {
            mockOfferedCorridors.mockReturnValue(['SEPA_EU'])
            const { result } = renderRouting(undefined, { claimable: blocked(blockedBy) })

            act(() => result.current.openCountry(GERMANY as any))

            expect(mockRouterPush).toHaveBeenCalledWith('/add-money/germany/bank')
        }
    )

    // The preference still holds where it can be acted on: an account they can
    // open on this tap is the better answer, because it is reusable.
    it('keeps the standing account where the user can open one', async () => {
        mockOfferedCorridors.mockReturnValue(['SEPA_EU'])
        const updates: UrlUpdateEvent[] = []
        const { result } = renderRouting((e) => updates.push(e), { claimable: blocked(undefined) })

        act(() => result.current.openCountry(PORTUGAL as any))

        await waitFor(() => expect(updates.at(-1)?.searchParams.get('corridor')).toBe('SEPA_EU'))
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('keeps the standing account where the user already holds a working one', async () => {
        mockOfferedCorridors.mockReturnValue(['SEPA_EU'])
        const updates: UrlUpdateEvent[] = []
        const { result } = renderRouting((e) => updates.push(e), {
            accounts: { SEPA_EU: { status: 'active' } } as any,
            claimable: blocked('account-limit'),
        })

        act(() => result.current.openCountry(PORTUGAL as any))

        await waitFor(() => expect(updates.at(-1)?.searchParams.get('corridor')).toBe('SEPA_EU'))
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    // Nothing is known yet, so nothing contradicts the account: the account
    // screens have their own loading state and resolve to the right one.
    it('keeps the standing account while the accounts are still being read', async () => {
        mockOfferedCorridors.mockReturnValue(['SEPA_EU'])
        const updates: UrlUpdateEvent[] = []
        const { result } = renderRouting((e) => updates.push(e), { isLoading: true })

        act(() => result.current.openCountry(PORTUGAL as any))

        await waitFor(() => expect(updates.at(-1)?.searchParams.get('corridor')).toBe('SEPA_EU'))
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('offers the waitlist only where a country has no corridor and no live rail', () => {
        const { result } = renderRouting()

        // Brazil's top-up needs no rail of the user's own
        expect(result.current.isCountrySupported(BRAZIL as any)).toBe(true)
        expect(result.current.isCountrySupported({ ...PORTUGAL, id: 'DEU' } as any)).toBe(true)
        expect(result.current.isCountrySupported(NIGERIA as any)).toBe(false)
    })
})
