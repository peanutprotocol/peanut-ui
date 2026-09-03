import type { Metadata } from 'next'
import PaymentNetworkExplorer from '@/features/payment-network-explorer/PaymentNetworkExplorer'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
    robots: { index: false, follow: false, nocache: true },
}

export default function PaymentGraphPage() {
    return <PaymentNetworkExplorer />
}
