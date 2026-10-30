'use client'

import MoneySettings from '@/components/Profile/views/MoneySettings.view'
import { BankUnlockIntroGate } from '@/components/Kyc/BankUnlockIntroGate'
import { useRouter } from 'next/navigation'

export default function AccountsPage() {
    const router = useRouter()
    return (
        <BankUnlockIntroGate visible onClose={() => router.push('/profile')}>
            <MoneySettings page="accounts" />
        </BankUnlockIntroGate>
    )
}
