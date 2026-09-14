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
            icon="alert"
            iconContainerClassName="bg-action-secondary"
            footer={
                <div className="space-y-3 w-full">
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
                    <LinkButton
                        className="self-center"
                        onClick={() => {
                            setShowConfirmationModal(false)
                            setClaimToExternalWallet(false)
                        }}
                    >
                        {t('addressCompatible.claimToPeanut')}
                    </LinkButton>
                </div>
            }
            preventClose={false}
            modalPanelClassName="max-w-md mx-8"
        />
    )
}
