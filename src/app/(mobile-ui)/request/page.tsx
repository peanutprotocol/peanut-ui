'use client'
import { useSearchParams } from 'next/navigation'
import PageContainer from '@/components/0_Bruddle/PageContainer'
import { CreatePotView } from '@/components/Request/link/views/CreatePotView'
import { CreateRequestLinkView } from '@/components/Request/link/views/Create.request.link.view'
import DirectRequestInitialView from '@/components/Request/direct-request/views/Initial.direct.request.view'

export default function RequestPage() {
    const searchParams = useSearchParams()
    const recipient = searchParams.get('recipient')

    if (recipient) {
        return (
            <PageContainer>
                <DirectRequestInitialView username={recipient} />
            </PageContainer>
        )
    }

    return (
        <PageContainer>
            {searchParams.get('mode') === 'pot' ? <CreatePotView /> : <CreateRequestLinkView />}
        </PageContainer>
    )
}
