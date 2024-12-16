import { Cashout } from '@/components'
import Layout from '@/components/Global/Layout'
import { generateMetadata } from '@/config'

export const dynamic = 'force-dynamic'

export const metadata = generateMetadata('cashout')

export default function CashoutPage() {
    return (
        <Layout>
            <Cashout />
        </Layout>
    )
}
