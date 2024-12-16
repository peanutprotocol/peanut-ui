import { Privacy } from '@/components'
import Layout from '@/components/Global/Layout'
import { generateMetadata } from '@/config'

export const metadata = generateMetadata('privacy')

export default function PrivacyPage() {
    return (
        <Layout>
            <Privacy />
        </Layout>
    )
}
