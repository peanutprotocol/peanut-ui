'use client'

import { AddWithdrawRouterView } from '@/components/AddWithdraw/AddWithdrawRouterView'
import { useRouter } from 'next/navigation'

export default function AddMoneyPage() {
    const router = useRouter()

    return (
        <AddWithdrawRouterView
            flow="add"
            pageTitle="Add Money"
            mainHeading="Where to add money from?"
            onBackClick={() => router.push('/home')}
        />
    )
}
