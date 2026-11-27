'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import type { KycActivationFeature, KycFeatureActivationResult } from '@/app/actions/kyc-feature-activation'
import { kycFeatureRefusalCopy } from '@/utils/kyc-feature-outcome.utils'
import { FeatureAction } from './FeatureAction'
import { ReplacementDocumentAction } from './ReplacementDocumentAction'
import { VerifyFooter, VerifyHeroLayout } from './components/VerifyLayout'
import { FeatureReadyScreen, FeatureSettingUpScreen } from './components/StatusScreens'
import { useKycControl } from './analytics'
import type { FeatureReportEntry } from '@/types/capabilities'
import type { FeatureReverificationEntry } from '@/app/actions/types/kyc-reverification.types'
import { currentReverificationDestination, featureReverificationPath } from '@/utils/kyc-reverification'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'

export function KycFeatureActivationStatus({
    feature,
    result,
    accountCurrency,
    accountStatus,
    isLoading,
    settling = false,
    onRetry,
    onBack,
    reverification,
}: {
    /** The feature whose words the screen shows; the Pix screens show local's for `pix`. */
    feature: Exclude<KycActivationFeature, 'pix'>
    result: KycFeatureActivationResult | null
    accountCurrency?: string
    accountStatus?: FeatureReportEntry
    isLoading: boolean
    /** The account was just asked for and usually opens in seconds: a progress screen, not a farewell. */
    settling?: boolean
    onRetry: () => void
    onBack: () => void
    reverification?: FeatureReverificationEntry | null
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const controls = useKycControl('feature-status', 'kyc_status')
    const tKyc = useTranslations('kyc')
    const entry =
        reverification ??
        (result?.kind === 'conflict' && result.code === 'feature_reverification_required' ? result.entry : null)
    if (entry)
        return (
            <VerifyHeroLayout
                statusTone="warning"
                screenId="feature-reverification-invitation"
                pose="thinking"
                onBack={onBack}
                title={t('reverify.inviteTitle')}
                description={t(
                    entry.feature === 'card'
                        ? 'reverify.inviteCard'
                        : entry.feature === 'bank'
                          ? 'reverify.inviteBank'
                          : 'reverify.inviteLocal'
                )}
                footer={
                    <VerifyFooter
                        actions={
                            <LinkButton
                                data-testid="feature-reverification-open"
                                className="w-full"
                                href={featureReverificationPath(entry, currentReverificationDestination())}
                            >
                                {t('continue')}
                            </LinkButton>
                        }
                    />
                }
            />
        )
    const report = accountStatus ?? (result?.kind === 'report' ? result.report : null)
    if (report?.state === 'action_required' && report.action?.startsWith('supplement:')) {
        return <FeatureAction action={report.action} onBack={onBack} onDone={onRetry} />
    }
    const identityRequired = !accountStatus && result?.kind === 'conflict' && result.code === 'identity_not_approved'
    // a start on arrival keeps this answer instead of redirecting: the set-up tap opens the questions
    const questionsRequired = !accountStatus && result?.kind === 'conflict' && result.code === 'questions_missing'
    const consent = (!accountStatus && !result) || identityRequired || questionsRequired
    const failed = !accountStatus && result?.kind === 'failed'
    const needsReplacement = report?.state === 'refused' && report.reason === 'identity_document_insufficient'
    const refused =
        report?.state === 'refused' ||
        report?.state === 'not_requested' ||
        (!accountStatus && result?.kind === 'conflict' && !identityRequired && !questionsRequired)
    // Non-supplement action_required (or an unknown future state) is NOT ready —
    // never show "You're all set" when the user still owes an action.
    const readyOrSettlingState =
        report?.state === 'on' ||
        report?.state === 'ready' ||
        report?.state === 'pending' ||
        report?.state === 'setting_up'
    // a tap would have shown the set-up screen here; on arrival the activation is already running
    if (settling && accountCurrency && !failed && !refused && (!report || readyOrSettlingState))
        return <FeatureSettingUpScreen currency={accountCurrency} onBack={onBack} />
    if (!consent && !failed && !refused && readyOrSettlingState && feature !== 'qr')
        return (
            <FeatureReadyScreen
                feature={feature}
                accountCurrency={accountCurrency}
                onDone={onBack}
                acknowledgement={report?.state === 'pending' || report?.state === 'setting_up'}
            />
        )
    return (
        <VerifyHeroLayout
            statusTone={failed || refused ? 'error' : 'warning'}
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
                        ? (accountStatus?.message ??
                          tKyc(kycFeatureRefusalCopy(report?.reason), {
                              feature: tKyc(`documents.${feature}` as never),
                          }))
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
