import PageContainer from '@/components/0_Bruddle/PageContainer'
import { ValidatedUsernameWrapper } from '@/components/Username/ValidatedUsernameWrapper'
import { DirectSendPageWrapper } from '@/features/payments/flows/direct-send/DirectSendPageWrapper'
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
            <ValidatedUsernameWrapper username={username}>
                <DirectSendPageWrapper username={username} />
            </ValidatedUsernameWrapper>
        </PageContainer>
    )
}
