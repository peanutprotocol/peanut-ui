import * as global_components from '@/components/global'
import * as components from '@/components'
import { Metadata } from 'next'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: `You've received a slot in a raffle!`,
    icons: {
        icon: '/logo-favicon.png',
    },
    openGraph: {
        images: [
            {
                url: '/claim-metadata-img.jpg',
            },
        ],
    },
    twitter: {
        images: [
            {
                url: '/claim-metadata-img.jpg',
            },
        ],
    },
}

export default function RafflePage() {
    return (
        <global_components.PageWrapper bgColor="bg-red">
            <components.RaffleClaim />
        </global_components.PageWrapper>
    )
}
