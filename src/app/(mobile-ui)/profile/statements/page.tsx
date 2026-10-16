import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { StatementsPage } from '@/features/statements/StatementsPage'

export const metadata = generateMetadata({
    title: 'Statements | Peanut',
    description: 'Download your Peanut activity as a PDF, CSV or XLSX file',
    image: '/metadata-img.png',
})

export default function StatementsRoute() {
    return (
        <PageContainer>
            <StatementsPage />
        </PageContainer>
    )
}
