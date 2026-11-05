'use client'

import { useTranslations } from 'next-intl'
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
import type { RailCapability } from '@/types/capabilities'
import { buildContactSupportMessage } from '@/utils/contact-support.utils'

const AVENIA = PROVIDERS['avenia-br']
/** Avenia's own verdict on the identity. Any other blocked rail is a failure on our side that support lifts. */
const AVENIA_KYC_REJECTED_REASON = 'avenia_kyc_rejected'

/**
 * Avenia's first use for a Brazilian resident: name Avenia and its terms,
 * open Avenia's hosted verification, and wait for the Pix rail. Renders
 * nothing once the rail is enabled, so the flow under it takes over.
 */
export function AveniaPixSetup({
    title,
    onBack,
    rail,
}: {
    /** The flow's own title ("Add money", "Withdraw"): a flow keeps one title across its steps. */
    title: string
    onBack: () => void
    rail: RailCapability | undefined
}) {
    const t = useTranslations('avenia.setup')
    const tCommon = useTranslations('common')
    const tLoading = useTranslations('loadingStates')
    const { openSupportWithMessage } = useModalsContext()
    const { user } = useAuth()
    const state = aveniaSetupState(rail)
    const kyc = useAveniaKycStart({ railEnabled: state === 'ready' })

    if (state === 'blocked') {
        return (
            <MantecaAccountUnavailable
                title={title}
                description={t(rail?.reason?.code === AVENIA_KYC_REJECTED_REASON ? 'rejected' : 'notAvailable')}
                onBack={onBack}
                // the rail's reason and id tell support which case this is (the contact-support action)
                onSupport={() =>
                    openSupportWithMessage(
                        buildContactSupportMessage({
                            reason: rail?.reason,
                            railId: rail?.id,
                            userId: user?.user?.userId,
                        })
                    )
                }
            />
        )
    }

    // Only the terms step starts Avenia: every start carries the acceptance, so the wait has no
    // "open again". Leaving and coming back shows the terms step, and its Continue opens a new link.
    if (kyc.isWaiting) {
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
