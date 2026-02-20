import ActionModal from '@/components/Global/ActionModal'

interface KycProcessingModalProps {
    visible: boolean
    onClose: () => void
}

// shown when user clicks a locked region while their kyc is pending/in review
export const KycProcessingModal = ({ visible, onClose }: KycProcessingModalProps) => {
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="clock"
            iconContainerClassName="bg-purple-3"
            title="Verification in progress"
            description="We're reviewing your identity. This usually takes less than a minute."
            ctas={[
                {
                    text: 'Got it',
                    onClick: onClose,
                    shadowSize: '4',
                },
            ]}
        />
    )
}
