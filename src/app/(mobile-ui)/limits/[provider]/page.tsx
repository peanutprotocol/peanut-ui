'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import BridgeLimitsPage from '@/components/Limits/BridgeLimitsPage.view'
import { LIMITS_PROVIDERS, type LimitsProvider } from '@/components/Limits/limits.consts'
import { useParams, notFound } from 'next/navigation'

export default function ProviderLimitsPage() {
    const params = useParams()
    const provider = params.provider as string

    // validate provider
    if (!LIMITS_PROVIDERS.includes(provider as LimitsProvider)) {
        notFound()
    }

    return <PageContainer>{provider === 'bridge' && <BridgeLimitsPage />}</PageContainer>
}
