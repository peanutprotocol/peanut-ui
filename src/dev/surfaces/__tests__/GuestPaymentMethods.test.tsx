import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { AuthContext, useAuth } from '@/context/authContext'
import { GuestPaymentMethods } from '../GuestPaymentMethods'

jest.mock('@/context/authContext', () => {
    const React = jest.requireActual('react')
    const AuthContext = React.createContext(undefined)
    return { AuthContext, useAuth: () => React.useContext(AuthContext) }
})

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockRouterPush }) }))
jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => ({
    useGeoFilteredPaymentOptions: () => ({
        filteredMethods: [
            { id: 'bank', title: 'Bank transfer', description: 'd', icons: [], soon: false },
            { id: 'mercadopago', title: 'Mercado Pago', description: 'd', icons: [], soon: false },
            { id: 'pix', title: 'Pix', description: 'd', icons: [], soon: false },
            { id: 'exchange-or-wallet', title: 'Crypto', description: 'd', icons: [], soon: false },
        ],
        isLoading: false,
    }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ canDo: () => true, bankRails: () => [] }),
}))
jest.mock('@/utils/general.utils', () => ({ saveRedirectUrl: jest.fn() }))
jest.mock('@/components/0_Bruddle/Divider', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/IconStack', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/Badges/Badge', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/0_Bruddle/ListItem', () => ({
    ListItem: (props: { title: React.ReactNode; onClick: () => void; disabled?: boolean }) => (
        <button onClick={props.onClick} disabled={props.disabled}>
            {props.title}
        </button>
    ),
}))

function OuterIdentity() {
    const auth = useAuth()
    return (
        <output data-testid="outer-identity">
            {JSON.stringify({ user: auth.user, loading: auth.isFetchingUser })}
        </output>
    )
}

beforeEach(() => jest.clearAllMocks())

it.each([
    ['signed in', { user: { user: { userId: 'outer-user' } }, isFetchingUser: false }],
    ['loading', { user: null, isFetchingUser: true }],
])('renders active guest funding choices inside a %s outer session without mutating it', (_label, identity) => {
    const outer = Object.freeze({ ...identity })
    const original = JSON.stringify(outer)
    render(
        <AuthContext.Provider value={outer as React.ContextType<typeof AuthContext>}>
            <GuestPaymentMethods />
            <OuterIdentity />
        </AuthContext.Provider>,
        { wrapper: IntlWrapper }
    )
    for (const title of ['Bank transfer', 'Mercado Pago', 'Pix']) {
        expect(screen.getByRole('button', { name: title })).toBeEnabled()
    }
    expect(screen.queryByText('Crypto')).not.toBeInTheDocument()
    expect(screen.getByTestId('outer-identity')).toHaveTextContent(
        JSON.stringify({ user: outer.user, loading: outer.isFetchingUser })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Bank transfer' }))
    expect(mockRouterPush).toHaveBeenCalledWith('/setup?redirect_uri=%2Fadd-money')
    expect(JSON.stringify(outer)).toBe(original)
})

it('adds an active external wallet choice only when its handler is supplied', () => {
    const onPay = jest.fn()
    const outer = { user: { user: { userId: 'outer-user' } }, isFetchingUser: false }
    render(
        <AuthContext.Provider value={outer as React.ContextType<typeof AuthContext>}>
            <GuestPaymentMethods onPayWithExternalWallet={onPay} />
        </AuthContext.Provider>,
        { wrapper: IntlWrapper }
    )
    const externalWallet = screen.getByRole('button', { name: 'Crypto' })
    expect(externalWallet).toBeEnabled()
    fireEvent.click(externalWallet)
    expect(onPay).toHaveBeenCalledTimes(1)
    expect(mockRouterPush).not.toHaveBeenCalled()
})
