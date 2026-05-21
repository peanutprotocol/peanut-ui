import React from 'react'
import ActionModal from '../ActionModal'
import useKycStatus from '@/hooks/useKycStatus'

const KycVerifiedOrReviewModal = ({
    isKycApprovedModalOpen,
    onClose,
}: {
    isKycApprovedModalOpen: boolean
    onClose: () => void
}) => {
    const { isUserBridgeKycUnderReview } = useKycStatus()

    return (
        <ActionModal
            visible={isKycApprovedModalOpen}
            onClose={onClose}
            title={isUserBridgeKycUnderReview ? 'Payment setup in review' : 'You’re already verified'}
            description={
                isUserBridgeKycUnderReview
                    ? "Your identity is already verified. We're setting up your payment methods and will notify you when they're ready."
                    : 'Your identity has already been successfully verified. No further action is needed.'
            }
            icon={isUserBridgeKycUnderReview ? 'clock' : 'shield'}
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
