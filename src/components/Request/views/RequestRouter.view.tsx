'use client'
import RouterViewWrapper from '@/components/RouterViewWrapper'
import { useRouter, useSearchParams } from 'next/navigation'
import DirectRequestInitialView from '../direct-request/views/Initial.direct.request.view'

export const RequestRouterView = () => {
    const router = useRouter()
    const searchParams = useSearchParams()
    const type = searchParams.get('type')
    const fromUsername = searchParams.get('from')

    if (type === 'direct' && fromUsername) {
        return <DirectRequestInitialView username={fromUsername} />
    }

    return (
        <RouterViewWrapper
            title="Request"
            linkCardTitle="Request via link"
            linkCardDescription="They don't need a Peanut account to pay you"
            onLinkCardClick={() => router.push('/request/create')}
            onUserSelect={(username) => router.push(`/request?type=direct&from=${username}`)}
        />
    )
}
