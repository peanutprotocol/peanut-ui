'use client'

import NavHeader from '@/components/Global/NavHeader'
import { useRouter } from 'next/navigation'
import { RequestLinkInitialView } from './views/Initial.link.request.view'

const RequestLinkFlowManager = () => {
    const router = useRouter()
    return (
        <div className="space-y-8">
            <NavHeader onPrev={() => router.push('/request')} title="Request" />
            <RequestLinkInitialView />
        </div>
    )
}

export default RequestLinkFlowManager
