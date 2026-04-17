'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ContributePotPageWrapper } from '@/features/payments/flows/contribute-pot/ContributePotPageWrapper'
import { SemanticRequestPageWrapper } from '@/features/payments/flows/semantic-request/SemanticRequestPageWrapper'
import PageContainer from '@/components/0_Bruddle/PageContainer'

// replaces the disabled catch-all [..recipient] route in native builds.
export default function PayRequestPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const requestId = searchParams.get('id')
    const chargeId = searchParams.get('chargeId')

    useEffect(() => {
        if (!requestId && !chargeId) router.replace('/home')
    }, [requestId, chargeId, router])

    if (requestId) {
        return (
            <PageContainer>
                <ContributePotPageWrapper requestId={requestId} />
            </PageContainer>
        )
    }

    if (chargeId) {
        return (
            <PageContainer>
                <SemanticRequestPageWrapper recipient={[]} />
            </PageContainer>
        )
    }

    return null
}
