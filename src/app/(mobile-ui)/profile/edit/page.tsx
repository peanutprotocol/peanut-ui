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
        // items-stretch hands PageContainer's own min-height down to the view,
        // so the pinned Save footer sits at the bottom edge without the view
        // re-declaring the height.
        <PageContainer className="items-stretch">
            <ProfileEditView />
        </PageContainer>
    )
}
