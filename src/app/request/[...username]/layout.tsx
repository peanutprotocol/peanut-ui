import { BASE_URL } from '@/constants'
import PaymentLayoutWrapper from '../../[...recipient]/payment-layout-wrapper'

export async function generateMetadata({ params }: any) {
    let title = 'Request | Peanut'
    let previewUrl = '/metadata-img.jpg'
    const host = BASE_URL

    if (!host) {
        console.error('Error: NEXT_PUBLIC_BASE_URL is not defined')
        return { title }
    }

    return {
        title,
        description: 'Request cryptocurrency from friends, family, or anyone else using Peanut',
        icons: {
            icon: '/logo-favicon.png',
        },
        openGraph: {
            images: [{ url: previewUrl }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: 'Request cryptocurrency from friends, family, or anyone else using Peanut',
        },
        keywords: 'crypto request, crypto payment, crypto invoice, crypto payment link',
    }
}

export default function RequestLayout({ children }: { children: React.ReactNode }) {
    return <PaymentLayoutWrapper>{children}</PaymentLayoutWrapper>
}
