import PaymentLayoutWrapper from '@/app/[...recipient]/payment-layout-wrapper'
import { generateMetadata as generateBaseMetadata } from '@/app/metadata'
import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { username: string[] } }): Promise<Metadata> {
    const username = params.username?.[0] ? decodeURIComponent(params.username[0]) : 'user'

    const defaultTitle = `Request Money from ${username} | Peanut`
    const defaultDescription = `Request digital dollars from ${username} using Peanut. Create and share P2P payment requests easily.`

    const baseMetadata = generateBaseMetadata({
        title: defaultTitle,
        description: defaultDescription,
        image: '/metadata-img.png',
        keywords: 'crypto request, P2P request, digital dollar request',
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

export default function DirectRequestLayout({ children }: { children: React.ReactNode }) {
    return <PaymentLayoutWrapper>{children}</PaymentLayoutWrapper>
}
