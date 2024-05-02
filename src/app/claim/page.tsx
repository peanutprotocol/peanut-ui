import { Metadata } from 'next'

import * as components from '@/components'
import Layout from '@/components/Global/Layout'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Send crypto with a link',
    metadataBase: new URL('https://peanut.to'),

    icons: {
        icon: '/logo-favicon.png',
    },
    openGraph: {
        images: [
            {
                url: '/metadata-img.png',
            },
        ],
    },
}

export default function ClaimPage() {
    return (
        <Layout>
            <components.Claim />
        </Layout>
    )
}
