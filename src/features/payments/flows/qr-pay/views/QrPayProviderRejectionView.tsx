'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import NavHeader from '@/components/Global/NavHeader'
import ActionModal from '@/components/Global/ActionModal'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { useModalsContext } from '@/context/ModalsContext'
import { QrKycState } from '@/constants/kyc.consts'
import type { IconName } from '@/components/Global/Icons/Icon'
import { useQrPayFlow } from '../QrPayFlowContext'

/** Provider rejection: user is Sumsub-approved but Manteca rejected. */
export function QrPayProviderRejectionView() {
    const t = useAppTranslations('qrPay')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const { gate, methodIcon, onBack } = useQrPayFlow()
    const { kycGateState, qrKycUserMessage, qrKycActionKey, sumsubFlow } = gate
    const { setIsSupportModalOpen } = useModalsContext()

    const isFixable = kycGateState === QrKycState.PROVIDER_REJECTION_FIXABLE
    const isRestartIdentity = kycGateState === QrKycState.PROVIDER_RESTART_IDENTITY

    return (
        <div className="flex min-h-inherit flex-col gap-8">
            <NavHeader title={tNav('pay')} />
            <ActionModal
                visible
                onClose={onBack}
                title={
                    isFixable
                        ? t('kyc.fixableTitle')
                        : isRestartIdentity
                          ? t('kyc.restartTitle')
                          : t('kyc.blockedTitle')
                }
                description={
                    isFixable
                        ? t('kyc.fixableDescription')
                        : isRestartIdentity
                          ? (qrKycUserMessage ?? t('kyc.restartDescription'))
                          : (qrKycUserMessage ?? t('kyc.blockedDescription'))
                }
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
                              variant: 'purple' as const,
                              shadowSize: '4' as const,
                              icon: 'upload-cloud' satisfies IconName,
                          }
                        : isRestartIdentity
                          ? {
                                text: t('kyc.restartTitle'),
                                onClick: () => sumsubFlow.handleRestartIdentity(),
                                variant: 'purple' as const,
                                shadowSize: '4' as const,
                                icon: 'upload-cloud' satisfies IconName,
                            }
                          : {
                                text: tCommon('contactSupport'),
                                onClick: () => setIsSupportModalOpen(true),
                                variant: 'stroke' as const,
                            },
                ]}
            />
            <SumsubKycModals flow={sumsubFlow} />
        </div>
    )
}
