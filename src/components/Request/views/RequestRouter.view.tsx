'use client'
import RouterViewWrapper from '@/components/RouterViewWrapper'
import { useRouter } from 'next/navigation'

export const RequestRouterView = () => {
    const router = useRouter()

    return (
        <RouterViewWrapper
            title="Request"
            linkCardTitle="Request via link"
            onLinkCardClick={() => router.push('/request/create')}
            onUserSelect={(username) => router.push(`/request/${username}`)}
        />
    )
}
