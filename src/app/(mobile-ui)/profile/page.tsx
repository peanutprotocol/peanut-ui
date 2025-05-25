import { generateMetadata } from '@/app/metadata'
import { Profile } from '@/components'
import PageContainer from '@/components/0_Bruddle/PageContainer'

export const metadata = generateMetadata({
    title: 'My Profile | Peanut',
    description:
        'Manage your Peanut profile and settings. Keep your information up to date for seamless P2P digital dollar transfers.',
})

export default function ProfilePage() {
    return (
        <PageContainer>
            <Profile />
        </PageContainer>
    )
}
