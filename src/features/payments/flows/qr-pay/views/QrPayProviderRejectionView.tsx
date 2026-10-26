'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import NavHeader from '@/components/Global/NavHeader'
import ActionModal from '@/components/Global/ActionModal'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useModalsContext } from '@/context/ModalsContext'
import { IDENTITY_DOCUMENT_MISSING_CODE, QR_IDENTITY_RESTART_PENDING_CODE, QrKycState } from '@/constants/kyc.consts'
import type { IconName } from '@/components/Global/Icons/Icon'
import { useQrPayFlow } from '../QrPayFlowContext'

/** Provider rejection: user is Sumsub-approved but Manteca rejected. */
export function QrPayProviderRejectionView() {
    const t = useAppTranslations('qrPay')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const { gate, methodIcon, onBack } = useQrPayFlow()
    const { kycGateState, qrKycUserMessage, qrKycActionKey, sumsubFlow, needsIdentityRestart, identityRestartReason } =
        gate
    const { setIsSupportModalOpen } = useModalsContext()

    const isFixable = kycGateState === QrKycState.PROVIDER_REJECTION_FIXABLE
    const isRestartIdentity = kycGateState === QrKycState.PROVIDER_RESTART_IDENTITY
    // The identity evidence behind an approval is missing: the user verifies
    // again, with any document. "A different document" is the country refusal.
    const isVerifyAgain = isRestartIdentity && needsIdentityRestart
    // Says why, per cause (Slava, 2026-10-26): an imported account with no ID on
    // file, a new ID check not finished, or an ID the payment partner cannot read.
    const verifyAgain =
        identityRestartReason === IDENTITY_DOCUMENT_MISSING_CODE
            ? ({ copy: 'documentMissing', icon: 'upload-cloud' } as const)
            : identityRestartReason === QR_IDENTITY_RESTART_PENDING_CODE
              ? ({ copy: 'restartPending', icon: 'check-circle' } as const)
              : ({ copy: 'unreadable', icon: 'upload-cloud' } as const)
    // A restart cooldown replaces the rejection prompt: the cooldown modal
    // (from SumsubKycModals below) is the one actionable surface, and
    // dismissing it leaves the flow rather than re-offering a restart that
    // the backend refuses anyway.
    const [kycPromptDismissed, setKycPromptDismissed] = useState(false)

    return (
        <PageStack>
            <NavHeader title={tNav('pay')} />
            <ActionModal
                visible={!kycPromptDismissed && !sumsubFlow.errorCooldown}
                onClose={onBack}
                title={
                    isFixable
                        ? t('kyc.fixableTitle')
                        : isVerifyAgain
                          ? t(`kyc.verifyAgain.${verifyAgain.copy}.title`)
                          : isRestartIdentity
                            ? t('kyc.restartTitle')
                            : t('kyc.blockedTitle')
                }
                description={
                    isFixable
                        ? t('kyc.fixableDescription')
                        : isVerifyAgain
                          ? t(`kyc.verifyAgain.${verifyAgain.copy}.description`)
                          : isRestartIdentity
                            ? (qrKycUserMessage ?? t('kyc.restartDescription'))
                            : (qrKycUserMessage ?? t('kyc.blockedDescription'))
                }
                tone="error"
                icon={
                    methodIcon ? (
                        <Image src={methodIcon} alt={t('paymentMethodAlt')} width={48} height={48} priority />
                    ) : undefined
                }
                ctas={[
                    isFixable
                        ? {
                              text: t('kyc.uploadDocument'),
                              onClick: () =>
                                  sumsubFlow.handleFixableRejection({
                                      provider: 'MANTECA',
                                      actionKey: qrKycActionKey,
                                  }),
                              variant: 'primary' as const,
                              shadowSize: '4' as const,
                              icon: 'upload-cloud' satisfies IconName,
                          }
                        : isRestartIdentity
                          ? {
                                text: isVerifyAgain
                                    ? t(`kyc.verifyAgain.${verifyAgain.copy}.cta`)
                                    : t('kyc.restartTitle'),
                                onClick: () => sumsubFlow.handleRestartIdentity(),
                                variant: 'primary' as const,
                                shadowSize: '4' as const,
                                icon: (isVerifyAgain ? verifyAgain.icon : 'upload-cloud') satisfies IconName,
                            }
                          : {
                                text: tCommon('contactSupport'),
                                onClick: () => setIsSupportModalOpen(true),
                                variant: 'secondary' as const,
                            },
                ]}
            />
            <SumsubKycModals
                flow={sumsubFlow}
                onCooldownClose={() => {
                    setKycPromptDismissed(true)
                    onBack()
                }}
            />
        </PageStack>
    )
}
