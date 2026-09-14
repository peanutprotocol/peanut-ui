import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { AboutView } from '@/components/Profile/views/About.view'
import packageJson from '../../../../../package.json'

export const metadata = generateMetadata({
    title: 'About Peanut | Peanut',
    description: 'Policies and app version',
    image: '/metadata-img.png',
})

export default function AboutPage() {
    return (
        <PageContainer>
            <AboutView appVersion={packageJson.version} />
        </PageContainer>
    )
}
