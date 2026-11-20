'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import NavHeader from '@/components/Global/NavHeader'
import ActionModal from '@/components/Global/ActionModal'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { KycRegionRestrictedModal } from '@/components/Kyc/modals/KycRegionRestrictedModal'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import { QrKycState } from '@/constants/kyc.consts'
import { useQrPayFlow } from '../QrPayFlowContext'
import { usePaperworkVerificationRedirect } from '@/features/paperwork-verification/usePaperworkVerificationRedirect'

// KYC screens come before any error screens - user needs to verify first.
export function QrPayKycGateView() {
    const t = useAppTranslations('qrPay')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const { gate, methodIcon, onBack } = useQrPayFlow()
    const { kycGateState, sumsubFlow, startVerification } = gate
    const refused = sumsubFlow.isQrUnlockRefused
    // A restart cooldown replaces the unlock prompt: the cooldown modal (from
    // SumsubKycModals below) is the one actionable surface, and dismissing it
    // leaves the flow rather than re-offering a verification that cannot start.
    const [kycPromptDismissed, setKycPromptDismissed] = useState(false)
    const unlockOffered =
        !kycPromptDismissed && !sumsubFlow.errorCooldown && kycGateState === QrKycState.REQUIRES_IDENTITY_VERIFICATION
    // a Smart Paperwork Verification user starts on /verify, never on this offer.
    // this view is the whole page, so it replaces itself (TASK-25011)
    const redirecting = usePaperworkVerificationRedirect(unlockOffered && !refused, { feature: 'qr' }, undefined, true)

    return (
        <PageStack>
            <NavHeader title={tNav('pay')} />
            <ActionModal
                visible={refused || (unlockOffered && !redirecting)}
                onClose={onBack}
                title={t(refused ? 'kyc.blockedTitle' : 'kyc.unlockTitle')}
                description={refused ? (sumsubFlow.error ?? t('kyc.blockedDescription')) : t('kyc.unlockDescription')}
                // the payment method's brand mark when known, else the QR pay concept (pink)
                {...(methodIcon
                    ? {
                          tone: 'info' as const,
                          icon: <Image src={methodIcon} alt={t('paymentMethodAlt')} width={48} height={48} priority />,
                      }
                    : { concept: 'qrPay' as const })}
                ctas={[
                    {
                        text: t(refused ? 'maintenance.goBack' : 'kyc.unlockCta'),
                        disabled: !refused && (sumsubFlow.isLoading || sumsubFlow.isQrUnlockBlocked),
                        onClick: refused ? onBack : startVerification,
                        variant: 'primary',
                        shadowSize: '4',
                        icon: 'check-circle',
                    },
                ]}
                footer={refused ? undefined : <PeanutDoesntStoreAnyPersonalInformation />}
            />
            {/* Re-uploading cannot change a jurisdictional refusal, so this
                surface owes the same one honest ending the drawer and
                InitiateKycModal give — never the unlock offer above. */}
            <KycRegionRestrictedModal visible={kycGateState === QrKycState.REGION_RESTRICTED} onClose={onBack} />
            <ActionModal
                visible={!refused && kycGateState === QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS}
                onClose={onBack}
                title={t('kyc.inProgressTitle')}
                description={t('kyc.inProgressDescription')}
                tone="attention"
                icon="shield"
                ctas={[
                    {
                        text: tCommon('continue'),
                        disabled: sumsubFlow.isLoading || sumsubFlow.isQrUnlockBlocked,
                        onClick: () => startVerification(),
                        variant: 'primary',
                        shadowSize: '4',
                        icon: 'check-circle',
                    },
                ]}
                tertiaryCta={{ text: t('kyc.notNow'), onClick: onBack }}
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
