import { Terms } from '@/components'
import Layout from '@/components/Global/Layout'
import { generateMetadata } from '../metadata'

export const metadata = generateMetadata({
    title: 'Terms of Service | Peanut',
    description: 'Legal terms and conditions for using Peanut and the Peanut Protocol',
    image: '/metadata-img.png',
    keywords: 'terms of service, legal, terms, conditions',
})

export default function TermsPage() {
    return (
        <Layout>
            <Terms />
        </Layout>
    )
}
