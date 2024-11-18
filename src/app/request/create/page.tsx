import { Metadata } from 'next'
import Layout from '@/components/Global/Layout'
import { CreateRequestLink } from '@/components/Request/Create/Create'

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
export default function RequestCreate() {
    return (
        <Layout className="!mx-0 w-full !px-0 !pt-0 ">
            <CreateRequestLink />
        </Layout>
    )
}
