'use client'
import MercadoPago from '@/components/AddMoney/components/RegionalMethods/MercadoPago'
import { CountryData, countryData } from '@/components/AddMoney/consts'
import { MantecaSupportedExchanges } from '@/components/AddMoney/consts'
import { useParams } from 'next/navigation'

export default function AddMoneyRegionalMethodPage() {
    const params = useParams()
    const country = params.country as string
    const method = params['regional-method'] as string

    const countryDetails: CountryData | undefined = countryData.find((c) => c.path === country)

    if (
        MantecaSupportedExchanges[countryDetails?.id as keyof typeof MantecaSupportedExchanges] &&
        method === 'mercadopago'
    ) {
        return <MercadoPago />
    }

    if (country === 'brazil' && method === 'pix') {
        return <MercadoPago />
    }

    return <div>Unsupported Method</div>
}
