import React from 'react'
import ActionModal from '../ActionModal'
import { useCapabilities } from '@/hooks/useCapabilities'

const KycVerifiedOrReviewModal = ({
    isKycApprovedModalOpen,
    onClose,
}: {
    isKycApprovedModalOpen: boolean
    onClose: () => void
}) => {
    const { bankRails } = useCapabilities()

    // "Under review" copy fires when bank rails are still provisioning (`pending`,
    // BE submitted to provider, no user action) AND none are enabled yet. An
    // already-enabled user gets the "already verified" copy instead.
    const allBankRails = bankRails()
    const isUnderReview =
        allBankRails.some((rail) => rail.status === 'pending') &&
        !allBankRails.some((rail) => rail.status === 'enabled')

    return (
        <ActionModal
            visible={isKycApprovedModalOpen}
            onClose={onClose}
            title={isUnderReview ? 'Your verification is under review' : 'You’re already verified'}
            description={
                isUnderReview
                    ? 'Your verification is under review. You will be notified when it is completed.'
                    : 'Your identity has already been successfully verified. No further action is needed.'
            }
            icon={isUnderReview ? 'clock' : 'shield'}
            ctas={[
                {
                    text: 'Go back',
                    shadowSize: '4',
                    className: 'md:py-2',
                    onClick: onClose,
                },
            ]}
        />
    )
}

export default KycVerifiedOrReviewModal
