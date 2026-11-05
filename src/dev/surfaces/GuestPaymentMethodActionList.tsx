'use client'

import { type ComponentProps } from 'react'
import { AuthContext, useAuth } from '@/context/authContext'
import { PaymentMethodActionList } from '@/features/payments/shared/components/PaymentMethodActionList'

export function GuestPaymentMethodActionList(props: ComponentProps<typeof PaymentMethodActionList>) {
    const auth = useAuth()
    // Keep the protected gallery signed in while staging guest-only payment choices.
    return (
        <AuthContext.Provider
            value={{ ...auth, user: null, userId: undefined, username: undefined, isFetchingUser: false }}
        >
            <PaymentMethodActionList {...props} />
        </AuthContext.Provider>
    )
}
