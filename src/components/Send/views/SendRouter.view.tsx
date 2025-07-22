'use client'
import RouterViewWrapper from '@/components/RouterViewWrapper'
import { useAppDispatch } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'

import LinkSendFlowManager from '../link/LinkSendFlowManager'

export const SendRouterView = () => {
    const router = useRouter()
    const dispatch = useAppDispatch()
    const searchParams = useSearchParams()
    const [isSendingByLink, setIsSendingByLink] = useState(false)

    const handleLinkCardClick = useCallback(() => {
        // Reset send flow state when entering link creation flow
        dispatch(sendFlowActions.resetSendFlow())
        setIsSendingByLink(true)
    }, [dispatch])

    // Check for createLink parameter on mount
    useEffect(() => {
        const createLink = searchParams.get('createLink')
        if (createLink === 'true') {
            handleLinkCardClick()
        }
    }, [searchParams, handleLinkCardClick])

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
