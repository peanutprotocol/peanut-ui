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
import { aveniaSetupState } from '@/features/avenia/avenia.utils'
import { useAveniaKycStart } from '@/features/avenia/hooks/useAveniaKycStart'
import type { CapabilityRoute } from '@/types/capabilities'
import { buildContactSupportMessage } from '@/utils/contact-support.utils'

const AVENIA = PROVIDERS['avenia-br']

/**
 * The user's step before Avenia Pix works, as the backend's route names it:
 * the identity check first, Avenia's first use (name Avenia and its terms,
 * open its hosted verification), the wait for Avenia's review, or why Pix
 * is closed. The flow under it renders once the route is ready.
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
    const tShared = useTranslations('avenia')
    const tCommon = useTranslations('common')
    const tLoading = useTranslations('loadingStates')
    const router = useRouter()
    const { openSupportWithMessage } = useModalsContext()
    const { user } = useAuth()
    const state = aveniaSetupState(route)
    const kyc = useAveniaKycStart({ railEnabled: state === 'ready' })

    if (state === 'rejected' || state === 'support' || state === 'unavailable') {
        return (
            <MantecaAccountUnavailable
                title={title}
                description={
                    state === 'rejected'
                        ? t('rejected')
                        : state === 'support'
                          ? t('notAvailable')
                          : tShared('unavailable')
                }
                onBack={onBack}
                // the route's reason tells support which case this is
                onSupport={() =>
                    openSupportWithMessage(
                        buildContactSupportMessage({ reason: route?.reason, userId: user?.user?.userId })
                    )
                }
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
                        <TitleBlock align="center" title={t('title')} description={t('verifyBody')} />
                    </div>
                    <Button variant="primary" className="w-full" onClick={() => router.push('/verify')}>
                        {t('verifyCta')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    // Only the terms step starts Avenia: every start carries the acceptance, so the wait has no
    // "open again". Leaving and coming back shows the terms step, and its Continue opens a new link.
    if (state === 'pending' || kyc.isWaiting) {
        return (
            <PageStack>
                <NavHeader title={title} onPrev={onBack} />
                <PageStack.Center>
                    <ProcessingScreen title={tLoading('gettingKycStatus')} description={t('checkingBody')} />
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
                        loading={kyc.isStarting}
                        disabled={kyc.isStarting}
                        onClick={() => void kyc.start()}
                    >
                        {tCommon('continue')}
                    </Button>
                    {/* The terms the tap agrees to, named by their title, under the button
                        (same shape as the deposit account claim). */}
                    <p className="text-center text-body-xs text-foreground-secondary">
                        {t.rich('terms', {
                            termsName: AVENIA.termsName ?? AVENIA.brand,
                            terms: (chunks) => (
                                <a
                                    href={AVENIA.termsUrl}
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
                    {kyc.error && <Callout priority="error">{kyc.error}</Callout>}
                </div>
            </PageStack.Center>
        </PageStack>
    )
}
