import { Profile } from '@/components'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { Metadata } from 'next'
import { BASE_URL } from '@/constants'

export const metadata: Metadata = {
    title: 'Profile | Peanut Protocol',
    description: 'Manage your Peanut profile',
    metadataBase: new URL(BASE_URL),

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
    return (
        <PageContainer>
            <Profile />
        </PageContainer>
    )
}
