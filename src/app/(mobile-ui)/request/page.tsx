import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { CreateRequestLinkView } from '@/components/Request/link/views/Create.request.link.view'

export const metadata = generateMetadata({
    title: 'Request Money | Peanut',
    description:
        'Request digital dollar payments easily with Peanut. Create and share payment requests for quick, peer-to-peer transactions.',
    image: '/metadata-img.png',
    keywords: 'crypto request, request money, cross-chain request, onramp, digital dollars',
})

export default function RequestPage() {
    return (
        <PageContainer>
            <CreateRequestLinkView />
        </PageContainer>
    )
}
