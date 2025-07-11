'use client'
import RouterViewWrapper from '@/components/RouterViewWrapper'
import { useAppDispatch } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import LinkSendFlowManager from '../link/LinkSendFlowManager'

export const SendRouterView = () => {
    const router = useRouter()
    const dispatch = useAppDispatch()
    const [isSendingByLink, setIsSendingByLink] = useState(false)

    const handleLinkCardClick = () => {
        // Reset send flow state when entering link creation flow
        dispatch(sendFlowActions.resetSendFlow())
        setIsSendingByLink(true)
    }

    const handlePrev = () => {
        // Reset send flow state when leaving link creation flow
        dispatch(sendFlowActions.resetSendFlow())
        setIsSendingByLink(false)
    }

    if (isSendingByLink) {
        return <LinkSendFlowManager onPrev={handlePrev} />
    }

    return (
        <RouterViewWrapper
            title="Send"
            linkCardTitle="Pay anyone with a link!"
            onLinkCardClick={handleLinkCardClick}
            onUserSelect={(username) => router.push(`/send/${username}`)}
        />
    )
}
