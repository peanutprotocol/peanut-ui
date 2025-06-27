'use client'

import AddWithdrawCountriesList from '@/components/AddWithdraw/AddWithdrawCountriesList'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'

// Dynamically import the bank page component
const AddMoneyBankPage = dynamic(() => import('@/components/AddMoney/BankPage'), { ssr: false })

const AddMoneyCountryPage = () => {
    const params = useParams()
    const countryPathParts = Array.isArray(params.country) ? params.country : [params.country]
    const isBankPage = countryPathParts[countryPathParts.length - 1] === 'bank'

    if (isBankPage) {
        return <AddMoneyBankPage />
    }

    return <AddWithdrawCountriesList flow="add" />
}

export default AddMoneyCountryPage
