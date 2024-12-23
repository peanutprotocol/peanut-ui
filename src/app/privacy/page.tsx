import { Privacy } from '@/components'
import Layout from '@/components/Global/Layout'
import { generateMetadata } from '../metadata'

export const metadata = generateMetadata({
    title: 'Privacy Policy | Peanut',
    description: 'Privacy policy for Peanut and the Peanut Protocol',
    image: '/metadata-img.png',
    keywords: 'privacy policy, legal, terms, conditions',
})

export default function PrivacyPage() {
    return (
        <Layout>
            <Privacy />
        </Layout>
    )
}
