'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { PROVIDERS } from '@/constants/providers.consts'
import { PixAccountOpening } from '@/features/pix/components/PixAccountOpening'
import { PixUnavailableScreen } from '@/features/pix/components/PixUnavailableScreen'
import { PixVerifyScreen } from '@/features/pix/components/PixVerifyScreen'
import { pixOpensWithoutTap, pixRouteTerms, pixSetupState } from '@/features/pix/pixRouteStep'
import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useRouteTermsAcceptance } from '@/hooks/useRouteTermsAcceptance'
import type { CapabilityRoute } from '@/types/capabilities'
import { pixProviderId } from '@/utils/provider.utils'

/**
 * The user's step before Pix works, as the backend's route names it: the identity check first, then
 * the provider's terms, which the user accepts here once (TASK-25073), then the account the first use
 * opens, then the wait while the provider opens it. Avenia's account opens with no tap and asks here
 * for any answer it still needs (`PixAccountOpening`); Manteca's first use keeps its consent
 * (`KycFeatureActivationGate`). The flow under it renders once the route is ready.
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
    const { nextActions } = useCapabilities()
    const state = pixSetupState(route, nextActions)
    // the terms the route names, in either of the API's shapes
    const routeTerms = state === 'accept-terms' ? pixRouteTerms(route, nextActions) : null
    const terms = useRouteTermsAcceptance(routeTerms?.key)
    // the provider whose terms the user accepts, as the route names it
    const providerId = pixProviderId(route?.provider)
    const provider = providerId ? PROVIDERS[providerId] : null

    // a consent screen names the terms it accepts: a provider this build has no record of goes to support
    if (state === 'support' || (state === 'accept-terms' && !provider))
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

    if (state === 'accept-terms') {
        return (
            <PageStack>
                <NavHeader title={title} onPrev={onBack} />
                <PageStack.Center>
                    <div className="flex flex-col items-center gap-4 text-center">
                        {/* the Pix mark: this is the Pix set-up, not a verification of ours (Aleks, 2026-11-12) */}
                        <IconBubble {...CONCEPT_ICONS.pix} size="l" />
                        <TitleBlock align="center" title={t('title')} description={t('body')} />
                        {/* The terms the tap agrees to, named and linked before the control that records the
                            consent (design.md, consent screens). The link is the document the API versions
                            and hashes. */}
                        <p className="text-body-s text-foreground-secondary">
                            {t.rich('terms', {
                                brand: provider?.brand ?? '',
                                terms: (chunks) => (
                                    <a
                                        href={routeTerms?.url ?? provider?.termsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline underline-offset-2"
                                    >
                                        {chunks}
                                    </a>
                                ),
                            })}
                        </p>
                    </div>
                    <div className="flex flex-col gap-4">
                        <Button
                            variant="primary"
                            className="w-full"
                            loading={terms.isAccepting}
                            disabled={terms.isAccepting}
                            onClick={() => void terms.accept()}
                        >
                            {t('acceptCta')}
                        </Button>
                        {providerId && (
                            <ProviderFinePrint providerId={providerId} label="accountProvider" prospective />
                        )}
                        {terms.error && <Callout priority="error">{terms.error}</Callout>}
                    </div>
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
