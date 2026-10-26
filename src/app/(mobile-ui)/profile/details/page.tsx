import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { ProfileDetailsView } from '@/components/Profile/views/ProfileDetails.view'

export const metadata = generateMetadata({
    title: 'Profile | Peanut',
    description: 'What you shared with Peanut at sign-up and in verification',
    image: '/metadata-img.png',
})

export default function ProfileDetailsPage() {
    return (
        <PageContainer>
            <ProfileDetailsView />
        </PageContainer>
    )
}
