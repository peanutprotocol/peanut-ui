'use client'

import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import ActionModal from '@/components/Global/ActionModal'
import { useTranslations } from 'next-intl'

interface ClaimAddressConfirmationModalProps {
    showConfirmationModal: boolean
    setShowConfirmationModal: (visible: boolean) => void
    isXChain: boolean
    onNext: () => void
    handleClaimLink: (bypassModal?: boolean) => void
    setClaimToExternalWallet: (value: boolean) => void
}

// external-address compatibility confirmation — markup moved verbatim from Initial.view.tsx
export const ClaimAddressConfirmationModal = ({
    showConfirmationModal,
    setShowConfirmationModal,
    isXChain,
    onNext,
    handleClaimLink,
    setClaimToExternalWallet,
}: ClaimAddressConfirmationModalProps) => {
    const t = useTranslations('claim')
    const tCommon = useTranslations('common')
    return (
        <ActionModal
            visible={showConfirmationModal}
            onClose={() => setShowConfirmationModal(false)}
            title={t('addressCompatible.title')}
            description={
                <div className="space-y-2">
                    <p>{t('addressCompatible.line1')}</p>
                    <p className="font-bold">{t('addressCompatible.line2')}</p>
                </div>
            }
            tone="attention"
            footer={
                <div className="flex w-full flex-col gap-6">
                    <SlideToConfirm
                        label={tCommon('slideToProceed')}
                        onConfirm={() => {
                            // for cross-chain claims, advance to the confirm screen first
                            if (isXChain) {
                                setShowConfirmationModal(false)
                                onNext()
                            } else {
                                // direct on-chain claim - initiate immediately
                                handleClaimLink(true)
                            }
                        }}
                    />
                    {/* the SlideToConfirm companion is the tertiary link, never a Button */}
                    <div className="flex justify-center">
                        <LinkButton
                            onClick={() => {
                                setShowConfirmationModal(false)
                                setClaimToExternalWallet(false)
                            }}
                        >
                            {t('addressCompatible.claimToPeanut')}
                        </LinkButton>
                    </div>
                </div>
            }
            preventClose={false}
        />
    )
}
