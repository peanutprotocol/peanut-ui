'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import type { KycActivationFeature, KycFeatureActivationResult } from '@/app/actions/kyc-feature-activation'
import { kycFeatureRefusalCopy } from '@/utils/kyc-feature-outcome.utils'
import { FeatureAction } from './FeatureAction'
import { ReplacementDocumentAction } from './ReplacementDocumentAction'
import { VerifyFooter, VerifyHeroLayout } from './components/VerifyLayout'
import { FeatureReadyScreen } from './components/StatusScreens'
import { useKycControl } from './analytics'

export function KycFeatureActivationStatus({
    feature,
    result,
    isLoading,
    onRetry,
    onBack,
}: {
    feature: KycActivationFeature
    result: KycFeatureActivationResult | null
    isLoading: boolean
    onRetry: () => void
    onBack: () => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const controls = useKycControl('feature-status', 'kyc_status')
    const tKyc = useTranslations('kyc')
    const report = result?.kind === 'report' ? result.report : null
    if (report?.state === 'action_required' && report.action?.startsWith('supplement:')) {
        return <FeatureAction action={report.action} onBack={onBack} onDone={onRetry} />
    }
    const identityRequired = result?.kind === 'conflict' && result.code === 'identity_not_approved'
    const consent = !result || identityRequired
    const failed = result?.kind === 'failed'
    const needsReplacement = report?.state === 'refused' && report.reason === 'identity_document_insufficient'
    const refused =
        report?.state === 'refused' ||
        report?.state === 'not_requested' ||
        (result?.kind === 'conflict' && !identityRequired)
    if (!consent && !failed && !refused && feature !== 'qr')
        return <FeatureReadyScreen feature={feature} onDone={onBack} />
    return (
        <VerifyHeroLayout
            screenId="feature-status"
            pose={failed || refused ? 'sad' : 'thinking'}
            onBack={onBack}
            title={
                consent
                    ? t(`activation.title.${feature}`)
                    : failed
                      ? t('loadFailed.title')
                      : refused && feature !== 'qr'
                        ? t(`addLater.title.${feature}`)
                        : tKyc('processingTitle')
            }
            description={
                consent
                    ? t(identityRequired ? 'activation.identityRequired' : 'activation.description')
                    : failed
                      ? t('loadFailed.description')
                      : refused
                        ? tKyc(kycFeatureRefusalCopy(report?.reason), {
                              feature: tKyc(`documents.${feature}` as never),
                          })
                        : tKyc('processingDescription')
            }
            footer={
                <VerifyFooter
                    actions={
                        needsReplacement ? (
                            <ReplacementDocumentAction
                                onTap={(action) => controls.track(action, 'tap')}
                                returnToFeature
                            />
                        ) : (
                            <Button
                                data-testid={consent ? 'kyc-activation-continue' : undefined}
                                className="w-full"
                                loading={isLoading}
                                disabled={isLoading}
                                onClick={() => {
                                    controls.track(consent ? 'continue' : failed ? 'retry' : 'done', 'tap')
                                    if (failed || consent) onRetry()
                                    else onBack()
                                }}
                            >
                                {consent
                                    ? t(`activation.cta.${feature}`)
                                    : failed
                                      ? t('loadFailed.retry')
                                      : t('addLater.doneCta')}
                            </Button>
                        )
                    }
                />
            }
        />
    )
}
