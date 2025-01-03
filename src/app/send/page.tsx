import { Metadata } from 'next'

import { Create } from '@/components'
import Layout from '@/components/Global/Layout'
import { generateMetadata } from '../metadata'

export const metadata = generateMetadata({
    title: 'Send Crypto | Peanut',
    description:
        'Send cryptocurrency securely using shareable links or to an email, phone number, ENS, or wallet address. Transfer tokens across chains easily with Peanut',
    image: '/metadata-img.png',
    keywords: 'crypto transfer, send crypto, cross-chain transfer, offramp, digital dollars',
})

export default function SendPage() {
    return (
        <Layout>
            <Create />
        </Layout>
    )
}
