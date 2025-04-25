import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { CreateRequestLinkView } from '@/components/Request/link/views/Create.request.link.view'

export const metadata = generateMetadata({
    title: 'Request Payment | Peanut',
    description: 'Request cryptocurrency from friends, family, or anyone else using Peanut on any chain.',
    image: '/metadata-img.png',
    keywords: 'crypto request, crypto payment, crypto invoice, crypto payment link',
})

export default function RequestCreate() {
    return (
        <PageContainer className="self-start">
            <CreateRequestLinkView />
        </PageContainer>
    )
}
