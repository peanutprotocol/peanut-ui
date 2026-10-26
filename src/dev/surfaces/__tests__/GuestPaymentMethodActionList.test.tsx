import React from 'react'
import { render } from '@testing-library/react'

const mockListRender = jest.fn()

jest.mock('@/context/authContext', () => {
    const React = jest.requireActual('react')
    const AuthContext = React.createContext(null)
    return { AuthContext, useAuth: () => React.useContext(AuthContext) }
})

jest.mock('@/features/payments/shared/components/PaymentMethodActionList', () => ({
    PaymentMethodActionList: (props: Record<string, unknown>) => {
        const { useAuth } = jest.requireMock('@/context/authContext')
        mockListRender({ props, auth: useAuth() })
        return null
    },
}))

import { GuestPaymentMethodActionList } from '../GuestPaymentMethodActionList'

const { AuthContext } = jest.requireMock('@/context/authContext')

it.each([false, true])('renders the list as a guest inside a signed-in shell (outer loading: %s)', (isFetchingUser) => {
    const fetchUser = jest.fn()
    const onPayWithExternalWallet = jest.fn()
    const outerAuth = {
        user: { user: { userId: 'signed-in-user', username: 'signed-in-name' } },
        userId: 'signed-in-user',
        username: 'signed-in-name',
        isFetchingUser,
        fetchUser,
    }
    render(
        <AuthContext.Provider value={outerAuth}>
            <GuestPaymentMethodActionList isAmountEntered onPayWithExternalWallet={onPayWithExternalWallet} />
        </AuthContext.Provider>
    )

    const { props, auth } = mockListRender.mock.lastCall[0]
    expect(props).toEqual({ isAmountEntered: true, onPayWithExternalWallet })
    expect(auth).toEqual({ ...outerAuth, user: null, userId: undefined, username: undefined, isFetchingUser: false })
    expect(fetchUser).not.toHaveBeenCalled()
})
