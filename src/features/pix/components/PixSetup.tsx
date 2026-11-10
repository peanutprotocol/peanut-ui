'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
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
import { PixHostedVerification } from '@/features/pix/components/PixHostedVerification'
import { PixUnavailableScreen } from '@/features/pix/components/PixUnavailableScreen'
import { pixPendingReason, pixSetupState } from '@/features/pix/pixFlow.utils'
import { KycFeatureActivationGate } from '@/features/paperwork-verification/KycFeatureActivationGate'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useRouteTermsAcceptance } from '@/hooks/useRouteTermsAcceptance'
import type { CapabilityRoute } from '@/types/capabilities'
import { pixProviderId } from '@/utils/provider.utils'

/**
 * The user's step before Pix works, as the backend's route names it: the
 * identity check first; the provider's terms, which the user accepts here;
 * then either the API shares the Peanut verification with the provider, or the
 * provider checks the identity on its own page (`PixHostedVerification`); the
 * account the first use opens; then the wait while the provider reviews it.
 * The flow under it renders once the route is ready.
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
    const tCommon = useTranslations('common')
    const tLoading = useTranslations('loadingStates')
    const router = useRouter()
    const { nextActions } = useCapabilities()
    // the next action the route's step names: the provider's terms, or its own identity check
    const routeAction = nextActions.find((action) => action.key === route?.action)
    const state = pixSetupState(route, routeAction?.kind)
    const terms = useRouteTermsAcceptance(state === 'accept-terms' ? route?.action : undefined)
    const pending = pixPendingReason(route?.reason?.code)
    // the provider whose terms the user accepts, as the route names it
    const providerId = pixProviderId(route?.provider)
    const provider = providerId ? PROVIDERS[providerId] : null

    // a consent screen names the terms it accepts: a provider this build has no record of goes to support
    if (
        state === 'support' ||
        (state === 'accept-terms' && !provider) ||
        (state === 'pending' && pending === 'cpf-missing')
    ) {
        return (
            <PixUnavailableScreen
                title={title}
                route={route}
                onBack={onBack}
                description={t(state === 'pending' ? 'cpfRequired' : 'notAvailable')}
            />
        )
    }

    if (state === 'hosted-verify' && routeAction) {
        return <PixHostedVerification title={title} onBack={onBack} action={routeAction} providerId={providerId} />
    }

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

    if (state === 'pending') {
        return (
            <PageStack>
                <NavHeader title={title} onPrev={onBack} />
                <PageStack.Center>
                    <ProcessingScreen
                        title={tLoading('gettingKycStatus')}
                        description={t(pending === 'import-unavailable' ? 'importUnavailable' : 'reviewing')}
                    />
                </PageStack.Center>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <NavHeader title={title} onPrev={onBack} />
            <PageStack.Center>
                <div className="flex flex-col items-center gap-4 text-center">
                    <IconBubble {...CONCEPT_ICONS.verification} size="l" />
                    <TitleBlock align="center" title={t('title')} description={t('body')} />
                </div>
                <div className="flex flex-col gap-4">
                    <Button
                        variant="primary"
                        className="w-full"
                        loading={terms.isAccepting}
                        disabled={terms.isAccepting}
                        onClick={() => void terms.accept()}
                    >
                        {tCommon('continue')}
                    </Button>
                    {/* The terms the tap agrees to, named and linked before the tap (design.md, consent
                        screens). The link is the document the API versions and hashes. */}
                    <p className="text-center text-body-xs text-foreground-secondary">
                        {t.rich('terms', {
                            termsName: provider?.termsName ?? provider?.brand ?? '',
                            terms: (chunks) => (
                                <a
                                    href={routeAction?.tosUrl ?? provider?.termsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline underline-offset-2"
                                >
                                    {chunks}
                                </a>
                            ),
                        })}
                    </p>
                    {providerId && <ProviderFinePrint providerId={providerId} label="accountProvider" prospective />}
                    {terms.error && <Callout priority="error">{terms.error}</Callout>}
                </div>
            </PageStack.Center>
        </PageStack>
    )
}
