import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { ProfileEditView } from '@/components/Profile/views/ProfileEdit.view'

export const metadata = generateMetadata({
    title: 'Edit Profile | Peanut',
    description: 'Edit your Peanut profile details',
    image: '/metadata-img.png',
})

export default function ProfileEditPage() {
    return (
        <PageContainer className="self-start">
            <ProfileEditView />
        </PageContainer>
    )
}
