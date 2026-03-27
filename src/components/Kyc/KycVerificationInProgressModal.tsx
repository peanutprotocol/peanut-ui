import { useRouter } from 'next/navigation'
import ActionModal from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'
import { type KycModalPhase } from '@/interfaces'

interface KycVerificationInProgressModalProps {
    isOpen: boolean
    onClose: () => void
    phase?: KycModalPhase
    onAcceptTerms?: () => void
    onSkipTerms?: () => void
    onContinue?: () => void
    tosError?: string | null
    isLoadingTos?: boolean
    preparingTimedOut?: boolean
    preparingStage?: 'initial' | 'configuring' | 'slow'
}

// multi-phase modal shown during and after kyc verification.
// phase transitions are controlled by the parent orchestrator (SumsubKycFlow).
export const KycVerificationInProgressModal = ({
    isOpen,
    onClose,
    phase = 'verifying',
    onAcceptTerms,
    onSkipTerms,
    onContinue,
    tosError,
    isLoadingTos,
    preparingTimedOut,
    preparingStage = 'initial',
}: KycVerificationInProgressModalProps) => {
    const router = useRouter()

    const handleGoHome = () => {
        onClose()
        router.push('/home')
    }

    if (phase === 'verifying') {
        return (
            <ActionModal
                visible={isOpen}
                onClose={onClose}
                icon={'clock' as IconName}
                iconContainerClassName="bg-yellow-1 text-black"
                title="We're verifying your identity"
                description={
                    <p>
                        This usually takes less than a minute. You can stay here while we finish, or return to the home
                        screen and we'll notify you when it's done.
                    </p>
                }
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
                footer={<PeanutDoesntStoreAnyPersonalInformation />}
            />
        )
    }

    if (phase === 'preparing') {
        // Progressive copy based on elapsed time in preparing phase
        const getPreparingCopy = () => {
            if (preparingTimedOut) {
                return {
                    title: 'Taking longer than expected',
                    description: "You can continue and we'll notify you when it's ready.",
                }
            }
            switch (preparingStage) {
                case 'initial':
                    return {
                        title: 'Setting up your account',
                        description: 'Preparing your payment methods...',
                    }
                case 'configuring':
                    return {
                        title: 'Setting up your account',
                        description: 'Configuring your regions...',
                    }
                case 'slow':
                    return {
                        title: 'Almost there',
                        description: 'This is taking a bit longer than usual. Hang tight.',
                    }
                default:
                    return {
                        title: 'Setting up your account',
                        description: 'Preparing your payment methods...',
                    }
            }
        }

        const { title, description } = getPreparingCopy()

        return (
            <ActionModal
                visible={isOpen}
                onClose={onClose}
                isLoadingIcon
                iconContainerClassName="bg-yellow-1 text-black"
                title={title}
                description={description}
                ctas={
                    preparingTimedOut
                        ? [
                              {
                                  text: 'Go to Home',
                                  onClick: handleGoHome,
                                  variant: 'purple',
                                  className: 'w-full',
                                  shadowSize: '4',
                              },
                          ]
                        : []
                }
                preventClose
                hideModalCloseButton
            />
        )
    }

    if (phase === 'bridge_tos') {
        const description =
            tosError || 'One more step: accept terms of service to enable bank transfers in the US, Europe, and Mexico.'

        return (
            <ActionModal
                visible={isOpen}
                onClose={onClose}
                icon={'check' as IconName}
                iconContainerClassName="bg-success-1 text-white"
                title="Identity verified!"
                description={description}
                ctas={[
                    {
                        text: tosError ? 'Continue' : 'Accept Terms',
                        onClick: tosError ? onClose : (onAcceptTerms ?? onClose),
                        disabled: isLoadingTos,
                        variant: 'purple',
                        className: 'w-full',
                        shadowSize: '4',
                    },
                ]}
                preventClose
                hideModalCloseButton
            />
        )
    }

    // phase === 'complete'
    return (
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            icon={'check' as IconName}
            iconContainerClassName="bg-success-1 text-white"
            title="All set!"
            description="Your account is ready to go."
            ctas={[
                {
                    text: 'Continue',
                    onClick: onContinue ?? onClose,
                    variant: 'purple',
                    className: 'w-full',
                    shadowSize: '4',
                },
            ]}
        />
    )
}
