import PageContainer from '@/components/0_Bruddle/PageContainer'
import BridgeLimitsPage from '@/components/Limits/BridgeLimitsPage.view'
import { LIMITS_PROVIDERS, type LimitsProvider } from '@/components/Limits/consts.limits'
import MantecaLimitsPage from '@/components/Limits/MantecaLimitsPage.view'
import { notFound } from 'next/navigation'

interface ProviderLimitsPageProps {
    params: Promise<{ provider: string }>
}

export default async function ProviderLimitsPage({ params }: ProviderLimitsPageProps) {
    const { provider } = await params

    // validate provider - notFound() is safe in server components
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
