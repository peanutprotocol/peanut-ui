import { Metadata } from 'next'
import * as components from '@/components'

export const metadata: Metadata = {
    // TODO: make metadata dynamic and change title based on if payment completed or not
    // see claim/page.tsx
    title: 'Peanut Protocol - Payment Request',
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
export default function RequestPay() {
    return <components.PayRequestLink />
}
