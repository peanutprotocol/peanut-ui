import PaymentLayoutWrapper from '@/app/[...recipient]/payment-layout-wrapper'
import { BASE_URL } from '@/constants'

export async function generateMetadata({ params }: any) {
    let title = 'Request Payment | Peanut'
    let previewUrl = '/metadata-img.jpg'
    const host = BASE_URL

    if (!host) {
        console.error('Error: NEXT_PUBLIC_BASE_URL is not defined')
        return { title }
    }

    return {
        title,
        description: 'Request cryptocurrency from friends, family, or anyone else using Peanut on any chain.',
        icons: {
            icon: '/logo-favicon.png',
        },
        openGraph: {
            images: [{ url: previewUrl }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: 'Request cryptocurrency from friends, family, or anyone else using Peanut on any chain.',
        },
        keywords: 'crypto payment, crypto transfer, crypto send, payment link',
    }
}

export default function DirectRequestLayout({ children }: { children: React.ReactNode }) {
    return <PaymentLayoutWrapper>{children}</PaymentLayoutWrapper>
}
