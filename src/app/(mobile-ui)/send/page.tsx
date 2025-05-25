import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { SendRouterView } from '@/components/Send/views/SendRouter.view'

export const metadata = generateMetadata({
    title: 'Send Money | Peanut - Instant P2P Digital Dollar Transfers',
    description: 'Send digital dollars globally in seconds with Peanut. Fast, secure, and easy peer-to-peer payments.',
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
