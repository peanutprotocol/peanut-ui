import { Metadata } from 'next'
import Layout from '@/components/Global/Layout'
import * as components from '@/components'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Send crypto via link',
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
export default function Home() {
    return (
        <Layout className="!mx-0 w-full !px-0 !pt-0 ">
            <components.Welcome />
        </Layout>
    )
}
