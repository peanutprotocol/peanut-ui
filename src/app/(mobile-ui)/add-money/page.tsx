'use client'

import { AddWithdrawRouterView } from '@/components/AddWithdraw/AddWithdrawRouterView'
import { useOnrampFlow } from '@/context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { checkIfInternalNavigation } from '@/utils'

export default function AddMoneyPage() {
    const router = useRouter()
    const { resetOnrampFlow } = useOnrampFlow()

    useEffect(() => {
        resetOnrampFlow()
    }, [])

    const handleBack = () => {
        // Check if the referrer is from the same domain (internal navigation)
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
