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

    return (
        <AddWithdrawRouterView
            flow="add"
            pageTitle="Add Money"
            mainHeading="Where to add money from?"
            onBackClick={() => router.push('/home')}
        />
    )
}
