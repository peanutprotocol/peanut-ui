'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import BridgeLimitsPage from '@/components/Limits/BridgeLimitsPage.view'
import { LIMITS_PROVIDERS, type LimitsProvider } from '@/components/Limits/consts.limits'
import MantecaLimitsPage from '@/components/Limits/MantecaLimitsPage.view'
import { useParams, notFound } from 'next/navigation'

export default function ProviderLimitsPage() {
    const params = useParams()
    const provider = params.provider as string

    // validate provider
    if (!LIMITS_PROVIDERS.includes(provider as LimitsProvider)) {
        notFound()
    }

    return (
        <PageContainer>
            {provider === 'bridge' && <BridgeLimitsPage />}
            {provider === 'manteca' && <MantecaLimitsPage />}
        </PageContainer>
    )
}
