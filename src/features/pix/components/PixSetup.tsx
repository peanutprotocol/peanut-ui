'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import { PixAccountOpening } from '@/features/pix/components/PixAccountOpening'
import { PixUnavailableScreen } from '@/features/pix/components/PixUnavailableScreen'
import { pixOpensWithoutTap, pixSetupState } from '@/features/pix/pixRouteStep'
import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import type { CapabilityRoute } from '@/types/capabilities'

/**
 * The user's step before Pix works, as the backend's route names it: the identity check first, then
 * the account the first use opens, then the wait while the provider opens it. Avenia's account opens
 * with no tap and asks here for any answer it still needs (`PixAccountOpening`); Manteca's first use
 * keeps its consent (`KycFeatureActivationGate`). The flow under it renders once the route is ready.
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
    const router = useRouter()
    const state = pixSetupState(route)

    if (state === 'support')
        return <PixUnavailableScreen title={title} route={route} onBack={onBack} description={t('notAvailable')} />

    if (state === 'activate' && pixOpensWithoutTap(route)) return <PixAccountOpening title={title} onBack={onBack} />

    // The first use opens the provider's account for Pix; the route turns ready once it is open.
    if (state === 'activate') {
        return (
            <KycFeatureActivationGate feature="local" scope={{ channel: 'bank', country: 'BR' }}>
                <Loading variant="mascot" />
            </KycFeatureActivationGate>
        )
    }

    if (state === 'verify') {
        return (
            <PageStack>
                <NavHeader title={title} onPrev={onBack} />
                <PageStack.Center>
                    <div className="flex flex-col items-center gap-4 text-center">
                        <IconBubble {...CONCEPT_ICONS.verification} size="l" />
                        <TitleBlock align="center" title={t('title')} />
                    </div>
                    <Button variant="primary" className="w-full" onClick={() => router.push('/verify')}>
                        {t('verifyCta')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

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
