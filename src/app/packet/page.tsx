import * as global_components from '@/components/global'
import * as components from '@/components'
import { Metadata } from 'next'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'You have been sent a red packet!',
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

export default function PacketPage() {
    return (
        <global_components.PageWrapper bgColor="bg-red">
            <components.Packet />
        </global_components.PageWrapper>
    )
}
