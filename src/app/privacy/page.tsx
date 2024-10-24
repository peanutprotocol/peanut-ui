// import * as components from '@/components'
import { Privacy } from '@/components'
import Layout from '@/components/Global/Layout'

import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Text Tokens',
    metadataBase: new URL('https://peanut.to'),

    icons: {
        icon: '/favicon.ico',
    },
    openGraph: {
        images: [
            {
                url: '/metadata-img.png',
            },
        ],
    },
}

export default function PrivacyPage() {
    return (
        <Layout>
            <Privacy />
        </Layout>
    )
}
