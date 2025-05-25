import PaymentPage from '@/app/[...recipient]/client'
import { generateMetadata as generateBaseMetadata } from '@/app/metadata'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { Metadata } from 'next'
import { use } from 'react'

type PageProps = {
    params: Promise<{ username?: string[] }>
}

export default function DirectPaymentPage(props: PageProps) {
    const params = use(props.params)
    const usernameSegments = params.username ?? []

    const recipient = usernameSegments

    return (
        <PageContainer className="min-h-[inherit]">
            <PaymentPage recipient={recipient} flow="direct_pay" />
        </PageContainer>
    )
}

export async function generateMetadata({ params }: { params: { username: string[] } }): Promise<Metadata> {
    const username = params.username?.[0] ? decodeURIComponent(params.username[0]) : 'user'

    const defaultTitle = `Send Money to ${username} | Peanut`
    const defaultDescription = `Send digital dollars to ${username} quickly and securely with Peanut. Fast P2P payments for Latin America and globally.`

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
