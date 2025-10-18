'use client'
import MantecaAddMoney from '@/components/AddMoney/components/MantecaAddMoney'
import { type CountryData, countryData } from '@/components/AddMoney/consts'
import { MantecaSupportedExchanges } from '@/components/AddMoney/consts'
import { useParams } from 'next/navigation'

export default function AddMoneyRegionalMethodPage() {
    const params = useParams()
    const country = params.country as string
    const method = params['regional-method'] as string

    const countryDetails: CountryData | undefined = countryData.find((c) => c.path === country)

    if (
        MantecaSupportedExchanges[countryDetails?.id as keyof typeof MantecaSupportedExchanges] &&
        method === 'manteca'
    ) {
        return <MantecaAddMoney source="regionalMethod" />
    }
    return null
}
