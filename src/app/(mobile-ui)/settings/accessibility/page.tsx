import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { AccessibilityView } from '@/components/Settings/AccessibilityView'

export const metadata = generateMetadata({
    title: 'Accessibility | Peanut',
    description: 'Adjust text size, motion and accessibility preferences.',
})

export default function AccessibilityPage() {
    return (
        <PageContainer>
            <AccessibilityView />
        </PageContainer>
    )
}
