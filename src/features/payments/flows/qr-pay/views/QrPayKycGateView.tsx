'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import NavHeader from '@/components/Global/NavHeader'
import ActionModal from '@/components/Global/ActionModal'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { KycRegionRestrictedModal } from '@/components/Kyc/modals/KycRegionRestrictedModal'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import { QrKycState } from '@/constants/kyc.consts'
import { useQrPayFlow } from '../QrPayFlowContext'

// KYC screens come before any error screens - user needs to verify first.
// MIGRATION-REVIEW: the `crossRegion` flag passed to handleInitiateKyc was `isUserSumsubKycApproved`
// (Sumsub identity cleared, only the regional Manteca uplift remains). Sumsub has no rail in the
// capability model, so — matching the MantecaFlowManager precedent (commit 8c98a3e81) — isKycApproved
// (any enabled rail ⇒ identity verified at least once) is the closest faithful proxy.
export function QrPayKycGateView() {
    const t = useAppTranslations('qrPay')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const { gate, methodIcon, targetMantecaCountry, onBack } = useQrPayFlow()
    const { kycGateState, sumsubFlow, isKycApproved } = gate

    return (
        <div className="flex min-h-inherit flex-col gap-8">
            <NavHeader title={tNav('pay')} />
            <ActionModal
                visible={kycGateState === QrKycState.REQUIRES_IDENTITY_VERIFICATION}
                onClose={onBack}
                title={t('kyc.unlockTitle')}
                description={t('kyc.unlockDescription')}
                icon={
                    methodIcon ? (
                        <Image src={methodIcon} alt={t('paymentMethodAlt')} width={48} height={48} priority />
                    ) : undefined
                }
                ctas={[
                    {
                        text: t('kyc.unlockCta'),
                        onClick: () =>
                            sumsubFlow.handleInitiateKyc(
                                'LATAM',
                                undefined,
                                isKycApproved || undefined,
                                targetMantecaCountry
                            ),
                        variant: 'purple',
                        shadowSize: '4',
                        icon: 'check-circle',
                    },
                ]}
                footer={<PeanutDoesntStoreAnyPersonalInformation />}
            />
            {/* Re-uploading cannot change a jurisdictional refusal, so this
                surface owes the same one honest ending the drawer and
                InitiateKycModal give — never the unlock offer above. */}
            <KycRegionRestrictedModal visible={kycGateState === QrKycState.REGION_RESTRICTED} onClose={onBack} />
            <ActionModal
                visible={kycGateState === QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS}
                onClose={onBack}
                title={t('kyc.inProgressTitle')}
                description={t('kyc.inProgressDescription')}
                icon="shield"
                ctas={[
                    {
                        text: tCommon('continue'),
                        onClick: () =>
                            sumsubFlow.handleInitiateKyc(
                                'LATAM',
                                undefined,
                                isKycApproved || undefined,
                                targetMantecaCountry
                            ),
                        variant: 'purple',
                        shadowSize: '4',
                        icon: 'check-circle',
                    },
                    {
                        text: t('kyc.notNow'),
                        onClick: onBack,
                        variant: 'stroke',
                        className: 'w-full',
                    },
                ]}
            />
            <SumsubKycModals flow={sumsubFlow} />
        </div>
    )
}
