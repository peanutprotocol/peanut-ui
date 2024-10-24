import * as components from '@/components'
import PageContainer from '@/components/0_Bruddle/PageContainer'

import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Peanut Protocol',
    description: 'Send crypto via link',
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

export default function KycPage() {
    return (
        <PageContainer>
            <components.KYCComponent />
        </PageContainer>
    )
}
