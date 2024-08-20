import * as components from '@/components'
import Layout from '@/components/Global/Layout'
import ToggleTheme from '@/components/Global/ToggleTheme'

import { Metadata } from 'next'

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

export default function JobsPage() {
    return (
        <Layout>
            <ToggleTheme />
        </Layout>
    )
}
