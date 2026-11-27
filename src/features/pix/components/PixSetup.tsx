'use client'

import { useTranslations } from 'next-intl'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import ProvideEmailStep from '@/components/Kyc/ProvideEmailStep'
import { markSubmitted } from '@/hooks/useSubmissionWindow'
import { PixAccountOpening } from '@/features/pix/components/PixAccountOpening'
import { PixUnavailableScreen } from '@/features/pix/components/PixUnavailableScreen'
import { PixVerifyScreen } from '@/features/pix/components/PixVerifyScreen'
import { pixOpensWithoutTap, pixSetupState } from '@/features/pix/pixRouteStep'
import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import type { CapabilityRoute } from '@/types/capabilities'

/**
 * The user's step before Pix works, as the backend's route names it: the identity check first, then
 * the account the first use opens, then the wait while the provider opens it. Avenia's account opens
 * with no tap and asks here for any answer it still needs (`PixAccountOpening`); Manteca's first use
 * keeps its consent (`KycFeatureActivationGate`). A user with no email adds one here. The flow under
 * it renders once the route is ready.
 */
export function PixSetup({
    title,
    onBack,
    route,
}: {
    /** The flow's own title ("Add money", "Withdraw"): a flow keeps one title across its steps. */
    title: string
    onBack: () => void
    route: CapabilityRoute | undefined
}) {
    const t = useTranslations('pix.setup')
    const tLoading = useTranslations('loadingStates')
    const state = pixSetupState(route)

    if (state === 'support')
        return <PixUnavailableScreen title={title} route={route} onBack={onBack} description={t('notAvailable')} />

    if (state === 'activate' && pixOpensWithoutTap(route))
        return <PixAccountOpening title={title} route={route} onBack={onBack} />

    // The first use opens the provider's account for Pix; the route turns ready once it is open.
    if (state === 'activate') {
        return (
            <KycFeatureActivationGate feature="local" scope={{ channel: 'bank', country: 'BR' }}>
                <Loading variant="mascot" />
            </KycFeatureActivationGate>
        )
    }

    if (state === 'verify') return <PixVerifyScreen title={title} onBack={onBack} />

    // Saving the email retries the account setup on the API: the route turns pending, then ready.
    if (state === 'email')
        return (
            <PageStack>
                <NavHeader title={title} onPrev={onBack} />
                <ProvideEmailStep visible onComplete={markSubmitted} onSkip={onBack} />
            </PageStack>
        )

    // pending, and ready for the moment before the flow under it renders
    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <PageStack.Center>
                <ProcessingScreen title={tLoading('gettingKycStatus')} description={t('reviewing')} />
            </PageStack.Center>
        </PageStack>
    )
}
