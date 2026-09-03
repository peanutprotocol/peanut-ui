/**
 * AddWithdrawRouterView — regression tests for the withdraw method-selection bounce.
 *
 * two regressions pinned here:
 * 1. clicking "Crypto" must set the method in context WITHOUT navigating to
 *    /withdraw/crypto (navigating pre-amount trips that page's "no amount"
 *    redirect guard, whose unmount cleanup resets the whole flow).
 * 2. a user-object refetch (new identity, same data) must NOT force the view
 *    back from the country list to saved accounts.
 *
 * uses the real WithdrawFlowContextProvider (pure useState, no heavy deps) so
 * the tests exercise the actual context wiring instead of a hand-rolled copy.
 */
import React, { useEffect } from 'react'
import { render as rtlRender, screen, fireEvent, cleanup } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, back: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
    useSearchParams: () => ({ get: () => null }),
    usePathname: () => '/withdraw',
}))

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), init: jest.fn() },
}))

jest.mock('@/utils/general.utils', () => ({
    getUserPreferences: jest.fn(() => undefined),
    updateUserPreferences: jest.fn(),
    getFromLocalStorage: jest.fn(() => null),
}))

jest.mock('@/utils/native-routes', () => ({
    addMoneyCountryUrl: (p: string) => `/add-money/${p}`,
    withdrawCountryUrl: (p: string, q?: string) => `/withdraw/${p}${q ?? ''}`,
    rewriteMethodPath: (p: string) => p,
}))

// spread the real module: the view now imports countryData, whose module-level
// setup reads MANTECA_SUPPORTED_EXCHANGES. Only isMantecaCountry is faked.
jest.mock('@/constants/manteca.consts', () => ({
    ...jest.requireActual('@/constants/manteca.consts'),
    isMantecaCountry: jest.fn(() => false),
}))

interface MockUser {
    user: { userId: string }
    accounts: Array<{ type: string; identifier: string; details: Record<string, unknown> }>
}

let mockUser: MockUser | null
jest.mock('@/redux/hooks', () => ({
    useUserStore: () => ({ user: mockUser }),
}))

jest.mock('@/context/OnrampFlowContext', () => ({
    useOnrampFlow: () => ({ setFromBankSelected: jest.fn() }),
}))

let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockRestrictions,
}))

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: (props: { onClick?: () => void; disabled?: boolean; children?: React.ReactNode }) => (
        <button onClick={props.onClick} disabled={props.disabled}>
            {props.children}
        </button>
    ),
}))

jest.mock('@/components/AddMoney/components/DepositMethodList', () => ({
    DepositMethodList: () => <div data-testid="deposit-method-list" />,
}))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: (props: { title?: string }) => <div data-testid="nav-header">{props.title}</div>,
}))

jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: (props: { children?: React.ReactNode }) => <div>{props.children}</div>,
}))

jest.mock('@/components/Profile/AvatarWithBadge', () => ({
    __esModule: true,
    default: () => <div />,
}))

jest.mock('../../Common/CountryList', () => ({
    CountryList: (props: { onCryptoClick?: () => void }) => (
        <div data-testid="country-list">
            <button data-testid="crypto-option" onClick={props.onCryptoClick}>
                Crypto
            </button>
        </div>
    ),
}))

jest.mock('../../Global/Loading', () => ({
    __esModule: true,
    default: (props: any) =>
        props.variant === 'mascot' ? (
            <div data-testid="loading">{props.message && <span>{props.message}</span>}</div>
        ) : (
            <div data-testid="loading-spinner" />
        ),
}))

jest.mock('../../Common/SavedAccountsView', () => ({
    __esModule: true,
    default: (props: { onSelectNewMethodClick?: () => void }) => (
        <div data-testid="saved-accounts-view">
            <button data-testid="select-new-method" onClick={props.onSelectNewMethodClick}>
                Select new method
            </button>
        </div>
    ),
}))

jest.mock('../../Global/TokenAndNetworkConfirmationModal', () => ({
    __esModule: true,
    default: () => null,
}))

import { AddWithdrawRouterView, withCurrentCountryPath } from '../AddWithdrawRouterView'
import { countryData } from '@/components/AddMoney/consts'
import type { RecentMethod } from '@/utils/general.utils'
import { WithdrawFlowContextProvider, useWithdrawFlow } from '@/context/WithdrawFlowContext'

// these components call useTranslations; IntlWrapper supplies the en catalog
// so the English assertions below keep asserting the real shipped copy
const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

const makeUser = (): MockUser => ({
    user: { userId: 'user-1' },
    accounts: [{ type: 'iban', identifier: 'BE10905272880104', details: {} }],
})

// exposes the real context's selectedMethod so tests can assert on it
const onSelectedMethodChange = jest.fn()
function SelectedMethodProbe() {
    const { selectedMethod } = useWithdrawFlow()
    useEffect(() => {
        if (selectedMethod) onSelectedMethodChange(selectedMethod)
    }, [selectedMethod])
    return null
}

function Harness({ user }: { user: MockUser }) {
    mockUser = user
    return (
        <IntlWrapper>
            <WithdrawFlowContextProvider>
                <AddWithdrawRouterView flow="withdraw" pageTitle="Withdraw" mainHeading="How?" />
                <SelectedMethodProbe />
            </WithdrawFlowContextProvider>
        </IntlWrapper>
    )
}

describe('AddWithdrawRouterView — withdraw method selection', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRestrictions = { banking: false, card: false }
    })

    // Every country on the list dead-ends for these residents; say so once here
    // rather than after three taps into a flow that cannot finish.
    test('names the bank restriction above the country list, and only when it applies', () => {
        render(<Harness user={makeUser()} />)
        fireEvent.click(screen.getByTestId('select-new-method'))
        expect(screen.queryByText(/Bank transfers aren't available in your country/i)).not.toBeInTheDocument()

        cleanup()
        mockRestrictions = { banking: true, card: false }
        render(<Harness user={makeUser()} />)
        fireEvent.click(screen.getByTestId('select-new-method'))
        expect(screen.getByText(/Bank transfers aren't available in your country/i)).toBeInTheDocument()
    })

    test('shows saved accounts by default when bank accounts exist', () => {
        render(<Harness user={makeUser()} />)
        expect(screen.getByTestId('saved-accounts-view')).toBeInTheDocument()
    })

    test('clicking Crypto sets the method in context and does NOT navigate', () => {
        render(<Harness user={makeUser()} />)
        fireEvent.click(screen.getByTestId('select-new-method'))
        fireEvent.click(screen.getByTestId('crypto-option'))

        expect(onSelectedMethodChange).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'crypto', title: 'Crypto' })
        )
        expect(mockRouterPush).not.toHaveBeenCalled()
    })

    test('a user refetch (new object identity) does not bounce the country list back to saved accounts', () => {
        const { rerender } = render(<Harness user={makeUser()} />)
        fireEvent.click(screen.getByTestId('select-new-method'))
        expect(screen.getByTestId('country-list')).toBeInTheDocument()

        // simulate the 4s pending-rail poll / window-focus refetch dispatching a fresh user object
        rerender(<Harness user={makeUser()} />)

        expect(screen.getByTestId('country-list')).toBeInTheDocument()
        expect(screen.queryByTestId('saved-accounts-view')).not.toBeInTheDocument()
    })
})

// Recent methods live in localStorage and outlive any deploy, so a country slug
// rename (TASK-21136 czechia, TASK-21138 saint-barthelemy) would otherwise leave
// saved entries pointing at a route that no longer resolves.
describe('withCurrentCountryPath — stale saved routes after a slug rename', () => {
    const saved = (over: Partial<RecentMethod> = {}): RecentMethod => ({
        type: 'country',
        id: 'CZE',
        title: 'Czechia',
        path: '/add-money/czech-republic',
        ...over,
    })

    test('repairs an entry saved under the old slug', () => {
        expect(withCurrentCountryPath(saved()).path).toBe('/add-money/czechia')
    })

    test('repairs the de-accented slug too', () => {
        const stale = saved({ id: 'BL', title: 'Saint Barthélemy', path: '/add-money/saint-barthélemy' })
        expect(withCurrentCountryPath(stale).path).toBe('/add-money/saint-barthelemy')
    })

    test('leaves an already-current entry untouched', () => {
        const current = saved({ path: '/add-money/czechia' })
        expect(withCurrentCountryPath(current)).toEqual(current)
    })

    test('never rewrites a crypto entry', () => {
        const crypto: RecentMethod = { type: 'crypto', id: 'crypto', title: 'Crypto', path: '/add-money/crypto' }
        expect(withCurrentCountryPath(crypto)).toBe(crypto)
    })

    test('keeps the stored path when the country is gone from the catalog', () => {
        const orphan = saved({ id: 'NOT_A_COUNTRY', path: '/add-money/atlantis' })
        expect(withCurrentCountryPath(orphan).path).toBe('/add-money/atlantis')
    })

    test('every stored country id still resolves, so no saved entry is orphaned', () => {
        const countries = countryData.filter((c) => c.type === 'country')
        const ids = countries.map((c) => c.id)
        expect(new Set(ids).size).toBe(ids.length)
        for (const c of countries) {
            expect(
                withCurrentCountryPath({ type: 'country', id: c.id, title: c.title, path: '/add-money/stale' }).path
            ).toBe(`/add-money/${c.path}`)
        }
    })
})
