'use client'
import RouterViewWrapper from '@/components/RouterViewWrapper'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import LinkSendFlowManager from '../link/LinkSendFlowManager'

export const SendRouterView = () => {
    const router = useRouter()
    const [isSendingByLink, setIsSendingByLink] = useState(false)

    if (isSendingByLink) {
        return <LinkSendFlowManager onPrev={() => setIsSendingByLink(false)} />
    }

    return (
        <RouterViewWrapper
            title="Send"
            linkCardTitle="Pay anyone with a link!"
            linkCardDescription="Create a link and send them money"
            onLinkCardClick={() => setIsSendingByLink(true)}
            onUserSelect={(username) => router.push(`/pay/${username}`)}
        />
    )
}
