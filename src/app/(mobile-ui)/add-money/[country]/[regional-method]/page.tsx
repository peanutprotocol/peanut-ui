'use client'
import MercadoPagoDepositDetails from '@/components/AddMoney/components/RegionalMethods/MercadoPago/MercadoPagoDepositDetails'
import { useParams } from 'next/navigation'

export default function AddMoneyRegionalMethodPage() {
    const params = useParams()
    const country = params.country as string
    const method = params['regional-method'] as string

    if (country === 'argentina' && method === 'mercadopago') {
        return <MercadoPagoDepositDetails />
    }

    return <div>Unsupported Method</div>
}
