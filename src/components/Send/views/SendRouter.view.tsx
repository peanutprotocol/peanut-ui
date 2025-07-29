'use client'
import RouterViewWrapper from '@/components/RouterViewWrapper'
import { useAppDispatch } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { useRouter, useSearchParams } from 'next/navigation'

import LinkSendFlowManager from '../link/LinkSendFlowManager'

export const SendRouterView = () => {
    const router = useRouter()
    const dispatch = useAppDispatch()
    const searchParams = useSearchParams()
    const isSendingByLink = searchParams.get('createLink') === 'true'

    const redirectToSendByLink = () => {
        // Reset send flow state when entering link creation flow
        dispatch(sendFlowActions.resetSendFlow())
        router.push(`${window.location.pathname}?createLink=true`)
    }

    const handlePrev = () => {
        // Reset send flow state when leaving link creation flow
        dispatch(sendFlowActions.resetSendFlow())
        router.back()
    }

    if (isSendingByLink) {
        return <LinkSendFlowManager onPrev={handlePrev} />
    }

    return (
        <RouterViewWrapper
            title="Send"
            linkCardTitle="Pay anyone with a link!"
            onLinkCardClick={() => {
                router.push(`${window.location.pathname}?createLink=false`) // preserve current URL
                redirectToSendByLink()
            }}
            onUserSelect={(username) => router.push(`/send/${username}`)}
        />
    )
}
