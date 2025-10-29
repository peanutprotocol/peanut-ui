import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { Badges } from '@/components/Badges'

export const metadata = generateMetadata({
    title: 'Badges | Peanut',
    description: 'See your badges and achievements.',
})

export default function BadgesPage() {
    return (
        <PageContainer>
            <Badges />
        </PageContainer>
    )
}
