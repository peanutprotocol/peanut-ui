import PageContainer from '@/components/0_Bruddle/PageContainer'
import BridgeLimitsView from '@/features/limits/views/BridgeLimitsView'
import MantecaLimitsView from '@/features/limits/views/MantecaLimitsView'

export const dynamicParams = false

export function generateStaticParams() {
    return [{ provider: 'bridge' }, { provider: 'manteca' }]
}

export default async function ProviderLimitsPage({ params }: { params: Promise<{ provider: string }> }) {
    const { provider } = await params

    return (
        <PageContainer>
            {provider === 'bridge' && <BridgeLimitsView />}
            {provider === 'manteca' && <MantecaLimitsView />}
        </PageContainer>
    )
}
