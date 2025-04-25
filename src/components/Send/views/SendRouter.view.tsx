'use client'
import NavHeader from '@/components/Global/NavHeader'
import RouterViewWrapper from '@/components/RouterViewWrapper'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import DirectSendInitialView from '../direct-send/views/Initial.direct.send.view'
import LinkSendFlowManager from '../link/LinkSendFlowManager'

export const SendRouterView = () => {
    const router = useRouter()
    const [isSendingByLink, setIsSendingByLink] = useState(false)
    const searchParams = useSearchParams()
    const type = searchParams.get('type')
    const toUsername = searchParams.get('to')

    if (isSendingByLink) {
        return <LinkSendFlowManager onPrev={() => setIsSendingByLink(false)} />
    }

    if (type === 'direct' && toUsername) {
        return (
            <div className="space-y-8">
                <NavHeader onPrev={() => router.push('/send')} title="Send" />
                <DirectSendInitialView username={toUsername} />
            </div>
        )
    }

    return (
        <RouterViewWrapper
            title="Send"
            linkCardTitle="Pay anyone with a link!"
            linkCardDescription="Create a link and send them money"
            onLinkCardClick={() => setIsSendingByLink(true)}
            onUserSelect={(username) => router.push(`/send?type=direct&to=${username}`)}
        />
    )
}
