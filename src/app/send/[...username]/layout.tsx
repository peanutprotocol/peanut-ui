import PaymentLayoutWrapper from '@/app/[...recipient]/payment-layout-wrapper'
import { generateMetadata as generateBaseMetadata } from '@/app/metadata'
import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { username: string[] } }): Promise<Metadata> {
    const username = params.username?.[0] ? decodeURIComponent(params.username[0]) : 'user'

    const defaultTitle = `Send Money to ${username} | Peanut`
    const defaultDescription = `Send digital dollars to ${username} using Peanut. Create and share P2P payment requests easily.`

    const baseMetadata = generateBaseMetadata({
        title: defaultTitle,
        description: defaultDescription,
        image: '/metadata-img.png',
        keywords: 'crypto send, P2P send, digital dollar send',
    })

    return {
        ...baseMetadata,
        title: defaultTitle,
        description: defaultDescription,
        openGraph: {
            ...baseMetadata.openGraph,
            title: defaultTitle,
            description: defaultDescription,
        },
        twitter: {
            ...baseMetadata.twitter,
            title: defaultTitle,
            description: defaultDescription,
        },
    }
}

export default function DirectSendLayout({ children }: { children: React.ReactNode }) {
    return <PaymentLayoutWrapper>{children}</PaymentLayoutWrapper>
}
