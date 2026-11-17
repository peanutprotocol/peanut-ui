'use client'

import { AuthContext, useAuth } from '@/context/authContext'
import { PaymentMethodActionList } from '@/features/payments/shared/components/PaymentMethodActionList'

/** These isolated choices are guest UI; the surrounding gallery stays signed in. */
export function GuestPaymentMethods({ onPayWithExternalWallet }: { onPayWithExternalWallet?: () => void }) {
    const auth = useAuth()
    return (
        <AuthContext.Provider
            value={{ ...auth, user: null, username: undefined, isFetchingUser: false, userFetchError: null }}
        >
            <div data-testid="guest-payment-methods">
                <PaymentMethodActionList isAmountEntered onPayWithExternalWallet={onPayWithExternalWallet} />
            </div>
        </AuthContext.Provider>
    )
}
