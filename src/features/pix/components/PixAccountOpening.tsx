'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import { AddFeatureQuestions } from '@/features/paperwork-verification/AddFeatureFlow'
import { KycFeatureActivationStatus } from '@/features/paperwork-verification/KycFeatureActivationStatus'
import { VerificationOutage } from '@/features/paperwork-verification/components/LoadScreens'
import { PixVerifyScreen } from '@/features/pix/components/PixVerifyScreen'
import { useKycFeatureActivation } from '@/features/paperwork-verification/useKycFeatureActivation'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import { markSubmitted } from '@/hooks/useSubmissionWindow'

// the account is being opened, or the API could not read the user's facts yet: both wait
const WAITING = new Set(['setting_up', 'pending'])

/**
 * The account the first Pix use opens, with no tap (Avenia, TASK-24947): the `pix` activation runs as
 * the page loads, for a resident of Brazil and for everyone else (API-CONTRACT-M3 section 3), and
 * the wait looks like the provider's review. An answer the provider still needs (the address, a CPF
 * for a resident) is asked here, on the verify flow's own question step (`feature=pix`), and the
 * activation runs again once it is saved; Back from the questions leaves Pix. A further missing step is
 * asked the same way; the step just answered asked again shows the failure screen, since an answer
 * cannot change after approval and asking it again would loop. An identity the API does not count
 * as approved gets Pix's own verify screen, not a redirect: Back from /verify would land here and be
 * sent straight back. A failure or a refusal
 * shows the activation's own status screen, in local's words. The route turns ready once the
 * account is open, and the flow under the setup renders.
 */
export function PixAccountOpening({ title, onBack }: { title: string; onBack: () => void }) {
    const t = useTranslations('pix.setup')
    const tLoading = useTranslations('loadingStates')
    const degraded = useKycDegraded()
    const activation = useKycFeatureActivation('pix', { enabled: !degraded, automatic: true })
    const result = activation.result
    const waiting = result?.kind === 'report' && WAITING.has(result.report.state)
    // the step the user last answered, and how many times they answered: each answer asks afresh
    const [answered, setAnswered] = useState<{ step: string | null | undefined; round: number } | null>(null)
    const missing = result?.kind === 'conflict' && result.code === 'questions_missing' ? result : null
    // the user poller reads the capabilities every few seconds, so the route moves on to its review
    useEffect(() => {
        if (waiting) markSubmitted()
    }, [waiting])

    if (degraded) return <VerificationOutage onBack={onBack} />
    if (missing && !activation.isLoading && !(answered && answered.step === missing.step))
        return (
            <div className="fixed inset-0 z-30 overflow-y-auto bg-white pt-safe-top pb-safe-bottom">
                <AddFeatureQuestions
                    key={answered?.round ?? 0}
                    feature="pix"
                    requiredStep={missing.step}
                    onBack={onBack}
                    onDone={() => {
                        setAnswered({ step: missing.step, round: (answered?.round ?? 0) + 1 })
                        void activation.activate()
                    }}
                />
            </div>
        )
    if (result?.kind === 'conflict' && result.code === 'identity_not_approved' && !activation.isLoading)
        return <PixVerifyScreen title={title} onBack={onBack} />
    if (!result || activation.isLoading || activation.allowed || waiting)
        return (
            <PageStack>
                <NavHeader title={title} onPrev={onBack} />
                <PageStack.Center>
                    <ProcessingScreen title={tLoading('gettingKycStatus')} description={t('reviewing')} />
                </PageStack.Center>
            </PageStack>
        )
    return (
        <KycFeatureActivationStatus
            feature="local"
            result={missing ? { kind: 'failed' } : result}
            isLoading={activation.isLoading}
            onRetry={() => void activation.activate()}
            onBack={onBack}
        />
    )
}
