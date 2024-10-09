import { Metadata, Viewport } from 'next'
import Layout from '@/components/Global/Layout'
import * as components from '@/components'

const app_title = 'Peanut Wallet'

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
    applicationName: 'Peanut Wallet',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black',
        title: app_title,
    },
    formatDetection: {
        telephone: false,
    },
}

export const viewport: Viewport = {
    themeColor: '#FFFFFF',
}

export default function Home() {
    return (
        <Layout className="!mx-0 w-full !px-0 !pt-0 ">
            <components.Welcome />
        </Layout>
    )
}
