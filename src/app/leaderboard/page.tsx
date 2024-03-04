import * as global_components from '@/components/global'
import * as components from '@/components'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Send crypto with a link',
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
export default function LeaderboardPage() {
    return (
        <global_components.PageWrapper showMarquee={false} bgColor="bg-lightblue">
            <components.Leaderboard />
        </global_components.PageWrapper>
    )
}
