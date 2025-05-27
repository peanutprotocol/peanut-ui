import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { SendRouterView } from '@/components/Send/views/SendRouter.view'

export const metadata = generateMetadata({
    title: 'Send Money | Peanut',
    description:
        'Send globally in seconds with just a link or direct transfer. Fast, secure, and easy peer-to-peer payments with Peanut.',
    image: '/metadata-img.png',
    keywords: 'crypto transfer, send crypto, cross-chain transfer, offramp, digital dollars',
})

export default function SendPage() {
    return (
        <PageContainer className="self-start">
            <SendRouterView />
        </PageContainer>
    )
}
