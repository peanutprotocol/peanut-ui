import { generateMetadata as generateBaseMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { DirectSendPageWrapper } from '@/features/payments/flows/direct-send/DirectSendPageWrapper'
import { type Metadata } from 'next'
import { use } from 'react'

type PageProps = {
    params: Promise<{ username?: string[] }>
}

export default function DirectPaymentPage(props: PageProps) {
    const params = use(props.params)
    const usernameSegments = params.username ?? []
    const username = usernameSegments[0] ? decodeURIComponent(usernameSegments[0]) : ''

    return (
        <PageContainer>
            <DirectSendPageWrapper username={username} />
        </PageContainer>
    )
}

export async function generateMetadata({ params }: { params: Promise<{ username: string[] }> }): Promise<Metadata> {
    const { username: usernameArray } = await params
    const username = usernameArray?.[0] ? decodeURIComponent(usernameArray[0]) : 'user'

    const defaultTitle = `Send Money to ${username} | Peanut`
    const defaultDescription = `Send digital dollars to ${username} quickly and securely with Peanut.`

    const baseMetadata = generateBaseMetadata({
        title: defaultTitle,
        description: defaultDescription,
    })

    return {
        ...baseMetadata,
        title: defaultTitle,
        description: defaultDescription,
        openGraph: {
            ...baseMetadata.openGraph,
            title: defaultTitle,
            description: defaultDescription,
        },
        twitter: {
            ...baseMetadata.twitter,
            title: defaultTitle,
            description: defaultDescription,
        },
    }
}
