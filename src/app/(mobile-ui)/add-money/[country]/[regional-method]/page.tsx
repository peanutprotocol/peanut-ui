'use client'
import MantecaAddMoney from '@/components/AddMoney/components/MantecaAddMoney'
import { type CountryData, countryData } from '@/components/AddMoney/consts'
import { MantecaSupportedExchanges } from '@/components/AddMoney/consts'
import { useParams, useSearchParams } from 'next/navigation'

export default function AddMoneyRegionalMethodPage() {
    const params = useParams()
    const searchParams = useSearchParams()
    // path params (web) or query params (native static export)
    const country = (params.country as string) || searchParams.get('country') || ''
    const method = (params['regional-method'] as string) || searchParams.get('view') || ''

    const countryDetails: CountryData | undefined = countryData.find((c) => c.path === country)

    if (
        MantecaSupportedExchanges[countryDetails?.id as keyof typeof MantecaSupportedExchanges] &&
        method === 'manteca'
    ) {
        return <MantecaAddMoney />
    }
    return null
}
