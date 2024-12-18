import { Jobs } from '@/components'
import Layout from '@/components/Global/Layout'
import { generateMetadata } from '@/config'

export const metadata = generateMetadata('jobs')

export default function JobsPage() {
    return (
        <Layout>
            <Jobs />
        </Layout>
    )
}
