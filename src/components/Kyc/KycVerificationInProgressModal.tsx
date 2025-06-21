import { useRouter } from 'next/navigation'
import ActionModal from '@/components/Global/ActionModal'
import { Icon, IconName } from '@/components/Global/Icons/Icon'

interface KycVerificationInProgressModalProps {
    isOpen: boolean
    onClose: () => void
}

// this modal is shown after the user submits their kyc information.
// it waits for a final status from the websocket before disappearing.
export const KycVerificationInProgressModal = ({ isOpen, onClose }: KycVerificationInProgressModalProps) => {
    const router = useRouter()

    const handleGoHome = () => {
        onClose()
        router.push('/home')
    }

    const descriptionWithInfo = (
        <p>
            This usually takes less than a minute. You can stay here while we finish, or return to the home screen and
            we'll notify you when it's done.
        </p>
    )

    return (
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            icon={'clock' as IconName}
            iconContainerClassName="bg-yellow-1 text-black"
            title="We're verifying your identity"
            description={descriptionWithInfo}
            ctas={[
                {
                    text: 'Go to Home',
                    onClick: handleGoHome,
                    variant: 'purple',
                    className: 'w-full',
                    shadowSize: '4',
                },
            ]}
            preventClose
            hideModalCloseButton
            footer={
                <div className="flex items-center gap-2 text-[11px] text-grey-1">
                    <Icon name="info" className="h-3 w-3" />
                    <span>Peanut doesn't store any personal information</span>
                </div>
            }
        />
    )
}
