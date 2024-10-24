import { Metadata } from 'next'
import { About } from '@/components/About'
import Layout from '@/components/Global/Layout'

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
export default function AboutPage() {
    return (
        <Layout className="!mx-0 w-full !px-0 ">
            <About />
        </Layout>
    )
}
