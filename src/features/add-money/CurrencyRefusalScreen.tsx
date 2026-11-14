'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { useModalsContextOptional } from '@/context/ModalsContext'
import { reasonCodeKey } from '@/constants/capability-reason-labels.consts'
import { useKycControl } from '@/features/paperwork-verification/analytics'
import { ReplacementDocumentAction } from '@/features/paperwork-verification/ReplacementDocumentAction'
import { VerifyFooter, VerifyHeroLayout } from '@/features/paperwork-verification/components/VerifyLayout'
import { kycFeatureRefusalCopy } from '@/utils/kyc-feature-outcome.utils'

export function CurrencyRefusalScreen({
    currency,
    reason,
    message,
    onBack,
}: {
    currency: string
    reason: string | undefined
    message?: string
    onBack: () => void
}) {
    const tDeposit = useTranslations('depositAccounts')
    const tIdentity = useTranslations('identity')
    const tKyc = useTranslations('kyc')
    const t = useTranslations('common')
    const controls = useKycControl('feature-status', 'kyc_status')
    const modals = useModalsContextOptional()
    const reasonKey = reasonCodeKey(reason)
    const description =
        reason === 'account_unavailable_in_residence'
            ? tDeposit('list.residenceRestrictedBody', { currency })
            : reasonKey
              ? tIdentity(reasonKey)
              : (message ??
                (!reason
                    ? tDeposit('list.notOfferedBody', { currency })
                    : tKyc(kycFeatureRefusalCopy(reason), { feature: tKyc('documents.bank') })))
    return (
        <VerifyHeroLayout
            statusTone="error"
            screenId="feature-status"
            pose="sad"
            onBack={onBack}
            title={tDeposit('gate.blockedTitle', { currency })}
            description={description}
            footer={
                <VerifyFooter
                    actions={
                        reason === 'identity_document_insufficient' ? (
                            <ReplacementDocumentAction
                                onTap={(action) => controls.track(action, 'tap')}
                                returnToFeature
                            />
                        ) : (
                            <Button
                                className="w-full"
                                onClick={() => {
                                    if (!modals) return onBack()
                                    controls.track('contact_support', 'tap')
                                    modals.setIsSupportModalOpen(true)
                                }}
                            >
                                {t(modals ? 'contactSupport' : 'gotIt')}
                            </Button>
                        )
                    }
                />
            }
        />
    )
}
