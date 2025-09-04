'use client'
import MercadoPago from '@/components/AddMoney/components/RegionalMethods/MercadoPago'
import { useParams } from 'next/navigation'

export default function AddMoneyRegionalMethodPage() {
    const params = useParams()
    const country = params.country as string
    const method = params['regional-method'] as string

    if (country === 'argentina' && method === 'mercadopago') {
        return <MercadoPago />
    }

    if (country === 'brazil' && method === 'pix') {
        return <MercadoPago />
    }

    return <div>Unsupported Method</div>
}
