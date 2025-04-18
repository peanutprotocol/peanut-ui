import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { RequestCreateView } from '@/components/Request/Create/Request.create.view'

export const metadata = generateMetadata({
    title: 'Request Payment | Peanut',
    description: 'Request cryptocurrency from friends, family, or anyone else using Peanut on any chain.',
    image: '/metadata-img.png',
    keywords: 'crypto request, crypto payment, crypto invoice, crypto payment link',
})

export default function RequestCreate() {
    return (
        <PageContainer>
            <RequestCreateView />
        </PageContainer>
    )
}
