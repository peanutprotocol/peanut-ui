'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import { AddFeatureQuestions } from '@/features/paperwork-verification/AddFeatureFlow'
import { KycFeatureActivationStatus } from '@/features/paperwork-verification/KycFeatureActivationStatus'
import { VerificationOutage } from '@/features/paperwork-verification/components/LoadScreens'
import { useKycFeatureActivation } from '@/features/paperwork-verification/useKycFeatureActivation'
import { useKycDegraded } from '@/hooks/useKycDegraded'
import { markSubmitted } from '@/hooks/useSubmissionWindow'

const PIX_SCOPE = { channel: 'bank', country: 'BR' } as const
// the account is being opened, or the API could not read the user's facts yet: both wait
const WAITING = new Set(['setting_up', 'pending'])

/**
 * The account the first Pix use opens, with no tap (Avenia, TASK-24947): the activation runs as the
 * page loads, and the wait looks like the provider's review. An answer the provider still needs (the
 * address, a CPF) is asked here, on the verify flow's own question step, and the activation runs
 * again once it is saved; Back from the questions leaves Pix. A failure or a refusal shows the
 * activation's own status screen. The route turns ready once the account is open, and the flow
 * under the setup renders.
 */
export function PixAccountOpening({ title, onBack }: { title: string; onBack: () => void }) {
    const t = useTranslations('pix.setup')
    const tLoading = useTranslations('loadingStates')
    const degraded = useKycDegraded()
    const activation = useKycFeatureActivation('local', { scope: PIX_SCOPE, enabled: !degraded, automatic: true })
    const result = activation.result
    const waiting = result?.kind === 'report' && WAITING.has(result.report.state)
    // the user poller reads the capabilities every few seconds, so the route moves on to its review
    useEffect(() => {
        if (waiting) markSubmitted()
    }, [waiting])

    if (degraded) return <VerificationOutage onBack={onBack} />
    if (result?.kind === 'conflict' && result.code === 'questions_missing')
        return (
            <div className="fixed inset-0 z-30 overflow-y-auto bg-white pt-safe-top pb-safe-bottom">
                <AddFeatureQuestions
                    feature="local"
                    requiredStep={result.step}
                    onBack={onBack}
                    onDone={() => void activation.activate()}
                />
            </div>
        )
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
            result={result}
            isLoading={activation.isLoading}
            onRetry={() => void activation.activate()}
            onBack={onBack}
        />
    )
}
