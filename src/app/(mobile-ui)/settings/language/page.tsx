import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { LanguageView } from '@/components/Settings/LanguageView'

export const metadata = generateMetadata({
    title: 'Language | Peanut',
    description: 'Choose the language of your Peanut app.',
})

export default function LanguagePage() {
    return (
        <PageContainer>
            <LanguageView />
        </PageContainer>
    )
}
