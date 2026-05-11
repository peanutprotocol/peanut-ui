'use client'

import AddMoneyBankDetails from '@/components/AddMoney/components/AddMoneyBankDetails'
import { useRouter } from 'next/navigation'

export default function USBankPage() {
    const router = useRouter()
    return <AddMoneyBankDetails flow="add-money" onBack={() => router.push('/add-money')} />
}
