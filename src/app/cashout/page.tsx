import * as components from '@/components'
import Layout from '@/components/Global/Layout'

export const dynamic = 'force-dynamic'

export default function ClaimPage() {
    return (
        <Layout>
            <components.Cashout />
        </Layout>
    )
}
