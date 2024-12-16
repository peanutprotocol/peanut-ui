import { Metadata } from 'next'

import { Create } from '@/components'
import Layout from '@/components/Global/Layout'
import { generateMetadata } from '@/config'

export const metadata = generateMetadata('send')

export default function SendPage() {
    return (
        <Layout>
            <Create />
        </Layout>
    )
}
