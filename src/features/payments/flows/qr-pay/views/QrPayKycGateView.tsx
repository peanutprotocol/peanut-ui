'use client'

import { useState } from 'react'
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
// The `crossRegion` flag means the identity itself has already cleared and only
// a regional uplift remains. Read that canonical identity status directly;
// "any enabled rail" is not equivalent (a card or unrelated country rail can
// be enabled independently).
export function QrPayKycGateView() {
    const t = useAppTranslations('qrPay')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const { gate, methodIcon, targetMantecaCountry, onBack } = useQrPayFlow()
    const { kycGateState, sumsubFlow, isIdentityVerified } = gate
    // A restart cooldown replaces the unlock prompt: the cooldown modal (from
    // SumsubKycModals below) is the one actionable surface, and dismissing it
    // leaves the flow rather than re-offering a verification that cannot start.
    const [kycPromptDismissed, setKycPromptDismissed] = useState(false)

    return (
        <div className="flex min-h-inherit flex-col gap-8">
            <NavHeader title={tNav('pay')} />
            <ActionModal
                visible={
                    !kycPromptDismissed &&
                    !sumsubFlow.errorCooldown &&
                    kycGateState === QrKycState.REQUIRES_IDENTITY_VERIFICATION
                }
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
                                isIdentityVerified || undefined,
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
                                isIdentityVerified || undefined,
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
            <SumsubKycModals
                flow={sumsubFlow}
                onCooldownClose={() => {
                    setKycPromptDismissed(true)
                    onBack()
                }}
            />
        </div>
    )
}
