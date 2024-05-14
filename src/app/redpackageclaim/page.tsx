import * as global_components from '@/components/global'
import * as components from '@/components'
import { headers } from 'next/headers'
import { Metadata, ResolvingMetadata } from 'next'
import { getLinkDetails } from '@squirrel-labs/peanut-sdk'
import * as utils from '@/utils'
export const dynamic = 'force-dynamic'
import { isMobile } from 'react-device-detect'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Send crypto with a link',

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

export default function ClaimPage() {
    return (
        <global_components.PageWrapper>
            <div
                className={
                    'center-xy brutalborder relative mx-auto mb-48 mt-5 flex w-10/12 flex-col items-center bg-white px-4  py-6 text-black lg:w-2/3 xl:w-1/2'
                }
                id={!isMobile ? 'cta-div' : ''}
            >
                {' '}
                <div>PUT CONTENT HERE KONRAD</div>
                gi{' '}
            </div>
        </global_components.PageWrapper>
    )
}
