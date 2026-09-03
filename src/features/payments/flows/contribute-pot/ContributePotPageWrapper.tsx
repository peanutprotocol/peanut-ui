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
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { requestsApi } from '@/services/requests'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useEffect, useState } from 'react'
import { type TRequestResponse } from '@/services/services.types'
import { useTranslations } from 'next-intl'

interface ContributePotPageWrapperProps {
    requestId: string
}

export function ContributePotPageWrapper({ requestId }: ContributePotPageWrapperProps) {
    const onBack = useSafeBack('/home')
    const t = useTranslations('payment')
    const [request, setRequest] = useState<TRequestResponse | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // fetch request details
    useEffect(() => {
        if (!requestId) {
            setError(t('errors.noRequestId'))
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
                setError(t('errors.requestLoadFailed'))
            })
            .finally(() => {
                setIsLoading(false)
            })
    }, [requestId, t])

    // loading state
    if (isLoading) {
        return (
            <div className="flex min-h-[inherit] w-full flex-col gap-4">
                <NavHeader title={t('headers.pay')} onPrev={onBack} />
                <div className="flex flex-grow flex-col items-center justify-center gap-4 py-8">
                    <Loading variant="mascot" />
                </div>
            </div>
        )
    }

    // error state — centered card (ruled 2026-09-03: no more lone top banner)
    if (error || !request) {
        return (
            <div className="flex min-h-[inherit] w-full flex-col gap-4">
                <NavHeader title={t('headers.pay')} onPrev={onBack} />
                <div className="flex flex-grow flex-col justify-center py-8">
                    <EmptyState
                        icon="search"
                        title={t('errors.requestNotFoundTitle')}
                        description={error || t('errors.requestNotFoundDescription')}
                    />
                </div>
            </div>
        )
    }

    return <ContributePotPage request={request} />
}
