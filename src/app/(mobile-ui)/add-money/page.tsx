'use client'

import { AddWithdrawRouterView } from '@/components/AddWithdraw/AddWithdrawRouterView'
import { useOnrampFlow } from '@/context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AddMoneyPage() {
    const router = useRouter()
    const { resetOnrampFlow } = useOnrampFlow()

    useEffect(() => {
        resetOnrampFlow()
    }, [])

    const handleBack = () => {
        // Check if there's a previous page in history
        if (window.history.length > 1) {
            router.back()
        } else {
            // Fallback to home if no history
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
