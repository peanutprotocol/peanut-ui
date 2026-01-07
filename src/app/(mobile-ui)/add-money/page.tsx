'use client'

import { AddWithdrawRouterView } from '@/components/AddWithdraw/AddWithdrawRouterView'
import { useOnrampFlow } from '@/context/OnrampFlowContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { checkIfInternalNavigation, getRedirectUrl, clearRedirectUrl, getFromLocalStorage } from '@/utils/general.utils'

export default function AddMoneyPage() {
    const router = useRouter()
    const { resetOnrampFlow } = useOnrampFlow()

    useEffect(() => {
        resetOnrampFlow()
    }, [])

    const handleBack = () => {
        // check if we have a saved redirect url (from request fulfillment or similar flows)
        const redirectUrl = getRedirectUrl()
        const fromRequestFulfillment = getFromLocalStorage('fromRequestFulfillment')

        if (redirectUrl && fromRequestFulfillment) {
            // clear the flags and navigate to saved url
            clearRedirectUrl()
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('fromRequestFulfillment')
            }
            router.push(redirectUrl)
            return
        }

        // fallback to standard navigation logic
        const isInternalReferrer = checkIfInternalNavigation()

        if (isInternalReferrer && window.history.length > 1) {
            router.back()
        } else {
            router.push('/home')
        }
    }

    return (
        <AddWithdrawRouterView
            flow="add"
            pageTitle="Add Money"
            mainHeading="Where to add money from?"
            onBackClick={handleBack}
        />
    )
}
