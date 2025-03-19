import * as components from '@/components'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { ThemeProvider } from '@/config'

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

export default function KycPage() {
    return (
        <PageContainer>
            <ThemeProvider>
                <components.KYCComponent />
            </ThemeProvider>
        </PageContainer>
    )
}
