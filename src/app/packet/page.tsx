import * as global_components from '@/components/global'
import * as components from '@/components'
import { headers } from 'next/headers'
import { Metadata, ResolvingMetadata } from 'next'
import { getLinkDetails } from '@squirrel-labs/peanut-sdk'
import * as utils from '@/utils'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'You have been sent a red packet!',

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

export default function WinPage() {
    return (
        <global_components.PageWrapper bgColor="bg-red">
            <components.Packet />
        </global_components.PageWrapper>
    )
}
