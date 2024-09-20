import { Metadata } from 'next'

import { Blog } from '@/components'
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

export default function BlogPage() {
    return (
        <Layout>
            <Blog />
        </Layout>
    )
}
