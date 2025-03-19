import * as components from '@/components'

import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Send crypto via link',
    metadataBase: new URL('https://peanut.me'),

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

export default function LinkAccountPage() {
    return <components.LinkAccountComponent />
}
