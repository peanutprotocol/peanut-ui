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
import { useModalsContextOptional } from '@/context/ModalsContext'
import type { FeatureReportEntry } from '@/types/capabilities'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'

export function KycFeatureActivationStatus({
    feature,
    result,
    accountCurrency,
    accountStatus,
    isLoading,
    onRetry,
    onBack,
}: {
    feature: KycActivationFeature
    result: KycFeatureActivationResult | null
    accountCurrency?: string
    accountStatus?: FeatureReportEntry
    isLoading: boolean
    onRetry: () => void
    onBack: () => void
}) {
    const t = useTranslations('kyc.paperworkVerification')
    const controls = useKycControl('feature-status', 'kyc_status')
    const tKyc = useTranslations('kyc')
    const tIdentity = useTranslations('identity')
    const tDeposit = useTranslations('depositAccounts')
    const tErrors = useTranslations('errors')
    const report = accountStatus ?? (result?.kind === 'report' ? result.report : null)
    if (report?.state === 'action_required' && report.action?.startsWith('supplement:')) {
        return <FeatureAction action={report.action} onBack={onBack} onDone={onRetry} />
    }
    const identityRequired = !accountStatus && result?.kind === 'conflict' && result.code === 'identity_not_approved'
    const consent = (!accountStatus && !result) || identityRequired
    const failed = !accountStatus && result?.kind === 'failed'
    const needsReplacement = report?.state === 'refused' && report.reason === 'identity_document_insufficient'
    const refused =
        report?.state === 'refused' ||
        report?.state === 'not_requested' ||
        (!accountStatus && result?.kind === 'conflict' && !identityRequired)
    const reasonKey = reasonCodeKey(report?.reason)
    const selectedRefused = !!accountCurrency && report?.state === 'refused'
    const refusalBody =
        selectedRefused && report?.reason === 'account_unavailable_in_residence'
            ? tDeposit('list.residenceRestrictedBody', { currency: accountCurrency })
            : selectedRefused && report?.reason === 'manteca_account_rejected'
              ? tErrors('mantecaAccountRejected')
              : selectedRefused && reasonKey
                ? tIdentity(reasonKey)
                : (accountStatus?.message ??
                  (selectedRefused && !report?.reason
                      ? tDeposit('gate.blockedBody', { currency: accountCurrency })
                      : tKyc(kycFeatureRefusalCopy(report?.reason), {
                            feature: tKyc(`documents.${feature}` as never),
                        })))
    if (!consent && !failed && !refused && feature !== 'qr')
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
                        ? selectedRefused
                            ? tDeposit('gate.blockedTitle', { currency: accountCurrency })
                            : t(`addLater.title.${feature}`)
                        : tKyc('processingTitle')
            }
            description={
                consent
                    ? t(identityRequired ? 'activation.identityRequired' : 'activation.description')
                    : failed
                      ? t('loadFailed.description')
                      : refused
                        ? refusalBody
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
                        ) : selectedRefused ? (
                            <AccountRefusalAction
                                onBack={onBack}
                                onSupport={() => controls.track('contact_support', 'tap')}
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

function AccountRefusalAction({ onBack, onSupport }: { onBack: () => void; onSupport: () => void }) {
    const t = useTranslations('common')
    const modals = useModalsContextOptional()
    return (
        <Button
            className="w-full"
            onClick={() => {
                if (!modals) return onBack()
                onSupport()
                modals.setIsSupportModalOpen(true)
            }}
        >
            {t(modals ? 'contactSupport' : 'gotIt')}
        </Button>
    )
}
