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
export default function AboutPage() {
    return (
        <Layout className="!mx-0 w-full !px-0 ">
            <components.About />
        </Layout>
    )
}
