/**
 * AddWithdrawRouterView — regression tests for the withdraw method-selection bounce.
 *
 * Two regressions pinned here:
 * 1. clicking "Crypto" must set the method in context WITHOUT navigating to
 *    /withdraw/crypto (navigating pre-amount trips that page's "no amount"
 *    redirect guard, whose unmount cleanup resets the whole flow).
 * 2. a user-object refetch (new identity, same data) must NOT force the view
 *    back from the country list to saved accounts.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

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

jest.mock('@/constants/manteca.consts', () => ({
    isMantecaCountry: jest.fn(() => false),
}))

let mockUser: any
jest.mock('@/redux/hooks', () => ({
    useUserStore: () => ({ user: mockUser }),
}))

// stateful withdraw-flow mock, wired up per-render by the harness below
let withdrawFlow: any
jest.mock('@/context/WithdrawFlowContext', () => ({
    useWithdrawFlow: () => withdrawFlow,
}))

jest.mock('@/context/OnrampFlowContext', () => ({
    useOnrampFlow: () => ({ setFromBankSelected: jest.fn() }),
}))

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: (props: any) => (
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
    default: (props: any) => <div data-testid="nav-header">{props.title}</div>,
}))

jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: (props: any) => <div>{props.children}</div>,
}))

jest.mock('@/components/Profile/AvatarWithBadge', () => ({
    __esModule: true,
    default: () => <div />,
}))

jest.mock('../../Common/CountryList', () => ({
    CountryList: (props: any) => (
        <div data-testid="country-list">
            <button data-testid="crypto-option" onClick={props.onCryptoClick}>
                Crypto
            </button>
        </div>
    ),
}))

jest.mock('../../Global/PeanutLoading', () => ({
    __esModule: true,
    default: () => <div data-testid="loading" />,
}))

jest.mock('../../Common/SavedAccountsView', () => ({
    __esModule: true,
    default: (props: any) => (
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

import { AddWithdrawRouterView } from '../AddWithdrawRouterView'

const makeUser = () => ({
    user: { userId: 'user-1' },
    accounts: [{ type: 'iban', identifier: 'BE10905272880104', details: {} }],
})

const mockSetSelectedMethod = jest.fn()

// harness giving the context mock real state so setShowAllWithdrawMethods re-renders
function Harness({ user }: { user: any }) {
    const [showAll, setShowAll] = React.useState(false)
    mockUser = user
    withdrawFlow = {
        showAllWithdrawMethods: showAll,
        setShowAllWithdrawMethods: setShowAll,
        setSelectedMethod: mockSetSelectedMethod,
        setSelectedBankAccount: jest.fn(),
    }
    return <AddWithdrawRouterView flow="withdraw" pageTitle="Withdraw" mainHeading="How?" />
}

describe('AddWithdrawRouterView — withdraw method selection', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('shows saved accounts by default when bank accounts exist', () => {
        render(<Harness user={makeUser()} />)
        expect(screen.getByTestId('saved-accounts-view')).toBeInTheDocument()
    })

    test('clicking Crypto sets the method in context and does NOT navigate', () => {
        render(<Harness user={makeUser()} />)
        fireEvent.click(screen.getByTestId('select-new-method'))
        fireEvent.click(screen.getByTestId('crypto-option'))

        expect(mockSetSelectedMethod).toHaveBeenCalledWith(expect.objectContaining({ type: 'crypto', title: 'Crypto' }))
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
