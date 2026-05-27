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
    const { railsForProvider } = useCapabilities()

    // MIGRATION-REVIEW: old `isUserBridgeKycUnderReview` === bridgeKycStatus 'under_review'
    // ("Bridge is actively reviewing submitted docs"). The capability equivalent is a Bridge
    // rail in `pending` (provisioning/submitted, no user action needed). Mapped to "any Bridge
    // rail pending && none enabled" so an already-enabled user still gets the "already verified"
    // copy rather than the "under review" copy.
    const bridgeRails = railsForProvider('bridge')
    const isBridgeUnderReview =
        bridgeRails.some((rail) => rail.status === 'pending') && !bridgeRails.some((rail) => rail.status === 'enabled')

    return (
        <ActionModal
            visible={isKycApprovedModalOpen}
            onClose={onClose}
            title={isBridgeUnderReview ? 'Your verification is under review' : 'You’re already verified'}
            description={
                isBridgeUnderReview
                    ? 'Your verification is under review. You will be notified when it is completed.'
                    : 'Your identity has already been successfully verified. No further action is needed.'
            }
            icon={isBridgeUnderReview ? 'clock' : 'shield'}
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
