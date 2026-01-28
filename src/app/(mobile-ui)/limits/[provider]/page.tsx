import PageContainer from '@/components/0_Bruddle/PageContainer'
import { LIMITS_PROVIDERS, type LimitsProvider } from '@/features/limits/consts'
import BridgeLimitsView from '@/features/limits/views/BridgeLimitsView'
import MantecaLimitsView from '@/features/limits/views/MantecaLimitsView'
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
            {provider === 'bridge' && <BridgeLimitsView />}
            {provider === 'manteca' && <MantecaLimitsView />}
        </PageContainer>
    )
}
