'use client'

import AddMoneyBankDetails from '@/components/AddMoney/components/AddMoneyBankDetails'
import { useSafeBack } from '@/hooks/useSafeBack'

export default function USBankPage() {
    const onBack = useSafeBack('/add-money')
    return <AddMoneyBankDetails flow="add-money" onBack={onBack} />
}
