'use client'

/**
 * wrapper component for ContributePotPage
 *
 * handles async request fetching before rendering the actual flow.
 * shows loading/error states while fetching.
 *
 * used by: /[...recipient]?id=xyz route when id param is a request pot uuid
 */

import { ContributePotPage } from './ContributePotPage'
import { requestsApi } from '@/services/requests'
import PeanutLoading from '@/components/Global/PeanutLoading'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { type TRequestResponse } from '@/services/services.types'

interface ContributePotPageWrapperProps {
    requestId: string
}

export function ContributePotPageWrapper({ requestId }: ContributePotPageWrapperProps) {
    const router = useRouter()
    const [request, setRequest] = useState<TRequestResponse | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // fetch request details
    useEffect(() => {
        if (!requestId) {
            setError('no request id provided')
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        setError(null)

        requestsApi
            .get(requestId)
            .then((data) => {
                setRequest(data)
            })
            .catch((err) => {
                console.error('failed to fetch request:', err)
                setError('failed to load request. it may not exist or has been deleted.')
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [requestId])

    // loading state
    if (isLoading) {
        return (
            <div className="flex min-h-[inherit] w-full flex-col gap-4">
                <NavHeader title="Pay" onPrev={() => router.back()} />
                <div className="flex flex-grow flex-col items-center justify-center gap-4 py-8">
                    <PeanutLoading />
                </div>
            </div>
        )
    }

    // error state
    if (error || !request) {
        return (
            <div className="flex w-full flex-col gap-4">
                <NavHeader title="Pay" onPrev={() => router.back()} />
                <ErrorAlert description={error || 'request not found'} />
            </div>
        )
    }

    return <ContributePotPage request={request} />
}
