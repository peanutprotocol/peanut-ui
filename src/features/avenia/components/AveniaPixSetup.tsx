'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { MantecaAccountUnavailable } from '@/components/Common/MantecaAccountUnavailable'
import NavHeader from '@/components/Global/NavHeader'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { PROVIDERS } from '@/constants/providers.consts'
import { useAuth } from '@/context/authContext'
import { useModalsContext } from '@/context/ModalsContext'
import { aveniaPendingReason, aveniaSetupState } from '@/features/avenia/avenia.utils'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useRouteTermsAcceptance } from '@/hooks/useRouteTermsAcceptance'
import type { CapabilityRoute } from '@/types/capabilities'
import { buildContactSupportMessage } from '@/utils/contact-support.utils'

const AVENIA = PROVIDERS['avenia-br']

/**
 * The user's step before Avenia Pix works, as the backend's route names it:
 * the identity check first; Avenia's terms, which the user accepts here (the
 * API then shares the Peanut verification with Avenia, so there is no second
 * check); then the wait while Avenia reviews it. The flow under it renders
 * once the route is ready.
 */
export function AveniaPixSetup({
    title,
    onBack,
    route,
}: {
    /** The flow's own title ("Add money", "Withdraw"): a flow keeps one title across its steps. */
    title: string
    onBack: () => void
    route: CapabilityRoute | undefined
}) {
    const t = useTranslations('avenia.setup')
    const tCommon = useTranslations('common')
    const tLoading = useTranslations('loadingStates')
    const router = useRouter()
    const { openSupportWithMessage } = useModalsContext()
    const { user } = useAuth()
    const { nextActions } = useCapabilities()
    const termsAction = nextActions.find((action) => action.key === route?.action)
    const state = aveniaSetupState(route, termsAction?.kind)
    const terms = useRouteTermsAcceptance(state === 'accept-terms' ? route?.action : undefined)
    const pending = aveniaPendingReason(route?.reason?.code)
    // the route's reason tells support which case this is
    const contactSupport = () =>
        openSupportWithMessage(buildContactSupportMessage({ reason: route?.reason, userId: user?.user?.userId }))

    if (state === 'support' || (state === 'pending' && pending === 'cpf-missing')) {
        return (
            <MantecaAccountUnavailable
                title={title}
                description={t(state === 'pending' ? 'cpfRequired' : 'notAvailable')}
                onBack={onBack}
                onSupport={contactSupport}
            />
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
                            termsName: AVENIA.termsName ?? AVENIA.brand,
                            terms: (chunks) => (
                                <a
                                    href={termsAction?.tosUrl ?? AVENIA.termsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline underline-offset-2"
                                >
                                    {chunks}
                                </a>
                            ),
                        })}
                    </p>
                    <ProviderFinePrint providerId="avenia-br" label="accountProvider" prospective />
                    {terms.error && <Callout priority="error">{terms.error}</Callout>}
                </div>
            </PageStack.Center>
        </PageStack>
    )
}
