'use client'

import { AddWithdrawRouterView } from '@/components/AddWithdraw/components/AddWithdrawRouterView'
import { useRouter } from 'next/navigation'

export default function WithdrawPage() {
    const router = useRouter()

    return (
        <AddWithdrawRouterView
            flow="withdraw"
            pageTitle="Withdraw Money"
            mainHeading="Where to withdraw to?"
            onBackClick={() => router.push('/home')}
            recentMethods={[]}
        />
    )
}
