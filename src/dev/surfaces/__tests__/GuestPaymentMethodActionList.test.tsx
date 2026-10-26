import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('@/context/authContext', () => {
    const React = jest.requireActual('react')
    const AuthContext = React.createContext(null)
    return { AuthContext, useAuth: () => React.useContext(AuthContext) }
})

jest.mock('@/features/payments/shared/components/PaymentMethodActionList', () => ({
    PaymentMethodActionList: (props: {
        isAmountEntered: boolean
        showDivider?: boolean
        onPayWithExternalWallet?: () => void
    }) => {
        const { useAuth } = jest.requireMock('@/context/authContext')
        const auth = useAuth()
        return (
            <div>
                <output data-testid="guest-auth">
                    {JSON.stringify({
                        user: auth.user,
                        userIdUndefined: auth.userId === undefined,
                        usernameUndefined: auth.username === undefined,
                        isFetchingUser: auth.isFetchingUser,
                    })}
                </output>
                <output data-testid="payment-props">
                    {JSON.stringify({ isAmountEntered: props.isAmountEntered, showDivider: props.showDivider })}
                </output>
                <button onClick={props.onPayWithExternalWallet}>External wallet</button>
            </div>
        )
    },
}))

import { GuestPaymentMethodActionList } from '../GuestPaymentMethodActionList'

const { AuthContext, useAuth } = jest.requireMock('@/context/authContext')

function OuterAuthProbe() {
    const auth = useAuth()
    return (
        <output data-testid="outer-auth">
            {JSON.stringify({
                user: auth.user,
                userId: auth.userId,
                username: auth.username,
                isFetchingUser: auth.isFetchingUser,
            })}
        </output>
    )
}

describe('guest payment choices inside a signed-in capture shell', () => {
    it.each([false, true])('isolates guest identity when outer loading is %s and forwards props', (isFetchingUser) => {
        const fetchUser = jest.fn()
        const onPayWithExternalWallet = jest.fn()
        const outerIdentity = {
            user: { user: { userId: 'signed-in-user', username: 'signed-in-name' } },
            userId: 'signed-in-user',
            username: 'signed-in-name',
            isFetchingUser,
        }
        const outerAuth = { ...outerIdentity, fetchUser }
        const { rerender } = render(
            <AuthContext.Provider value={outerAuth}>
                <GuestPaymentMethodActionList
                    isAmountEntered={true}
                    showDivider={false}
                    onPayWithExternalWallet={onPayWithExternalWallet}
                />
                <OuterAuthProbe />
            </AuthContext.Provider>
        )

        const expectedGuest = {
            user: null,
            userIdUndefined: true,
            usernameUndefined: true,
            isFetchingUser: false,
        }
        expect(JSON.parse(screen.getByTestId('guest-auth').textContent!)).toEqual(expectedGuest)
        expect(JSON.parse(screen.getByTestId('outer-auth').textContent!)).toEqual(outerIdentity)
        expect(JSON.parse(screen.getByTestId('payment-props').textContent!)).toEqual({
            isAmountEntered: true,
            showDivider: false,
        })
        expect(fetchUser).not.toHaveBeenCalled()
        expect(onPayWithExternalWallet).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'External wallet' }))
        expect(onPayWithExternalWallet).toHaveBeenCalledTimes(1)

        rerender(
            <AuthContext.Provider value={outerAuth}>
                <GuestPaymentMethodActionList isAmountEntered={false} showDivider={true} />
                <OuterAuthProbe />
            </AuthContext.Provider>
        )
        expect(JSON.parse(screen.getByTestId('payment-props').textContent!)).toEqual({
            isAmountEntered: false,
            showDivider: true,
        })
        expect(JSON.parse(screen.getByTestId('guest-auth').textContent!)).toEqual(expectedGuest)
        expect(JSON.parse(screen.getByTestId('outer-auth').textContent!)).toEqual(outerIdentity)
        expect(outerAuth).toEqual({ ...outerIdentity, fetchUser })
        expect(fetchUser).not.toHaveBeenCalled()
    })
})
