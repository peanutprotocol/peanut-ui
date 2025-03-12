import { Profile } from '@/components'

import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Send to Anyone',
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

export default function ProfilePage() {
    return <Profile />
}
