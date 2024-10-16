import { Metadata } from 'next'

import * as components from '@/components'
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

// note: this page may exist only for testing purposes, and the Setup component
// may only be part of other flows

export default function SetupPage() {
    return (
        <Layout>
            <components.Setup />
        </Layout>
    )
}
