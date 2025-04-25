import { generateMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { RequestRouterView } from '@/components/Request/views/RequestRouter.view'

export const metadata = generateMetadata({
    title: 'Request Money | Peanut',
    description:
        'Request cryptocurrency securely using shareable links or from an email, phone number, ENS, or wallet address. Request tokens across chains easily with Peanut',
    image: '/metadata-img.png',
    keywords: 'crypto request, request money, cross-chain request, onramp, digital dollars',
})

export default function RequestPage() {
    return (
        <PageContainer className="self-start">
            <RequestRouterView />
        </PageContainer>
    )
}
