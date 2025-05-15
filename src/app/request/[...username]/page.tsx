import PageContainer from '@/components/0_Bruddle/PageContainer'
import DirectRequestInitialView from '@/components/Request/direct-request/views/Initial.direct.request.view'
import { use } from 'react'

type PageProps = {
    params: Promise<{ username?: string[] }>
}

export default function DirectRequestPage(props: PageProps) {
    const params = use(props.params)
    const usernameSegments = params.username ?? []

    const recipient = usernameSegments

    return (
        <PageContainer className="self-start">
            <DirectRequestInitialView username={recipient[0]} />
        </PageContainer>
    )
}
