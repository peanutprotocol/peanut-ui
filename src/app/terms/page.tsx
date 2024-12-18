import { Terms } from '@/components'
import Layout from '@/components/Global/Layout'
import { generateMetadata } from '@/config'

export const metadata = generateMetadata('terms')

export default function TermsPage() {
    return (
        <Layout>
            <Terms />
        </Layout>
    )
}
