import { Metadata } from 'next'

// import * as components from '@/components'
import { Refund } from '@/components'
import Layout from '@/components/Global/Layout'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Text Tokens',
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

export default function RefundPage() {
    return (
        <Layout>
            <Refund />
        </Layout>
    )
}
