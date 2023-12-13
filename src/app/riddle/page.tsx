import * as global_components from '@/components/global'
import * as components from '@/components'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Send crypto with a link',

    icons: {
        icon: '/logo-favicon.png',
    },
    openGraph: {
        images: [
            {
                url: '/metadata-img.jpg',
            },
        ],
    },
}

export default function BlogPage() {
    return (
        <global_components.PageWrapper showMarquee={false} bgColor="bg-yellow">
            <components.Riddle />
        </global_components.PageWrapper>
    )
}
