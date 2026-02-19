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
        return (
            <ActionModal
                visible={isOpen}
                onClose={onClose}
                isLoadingIcon
                iconContainerClassName="bg-yellow-1 text-black"
                title="Identity verified!"
                description={
                    preparingTimedOut
                        ? "This is taking longer than expected. You can continue and we'll notify you when it's ready."
                        : 'Preparing your account...'
                }
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
                        onClick: tosError ? (onSkipTerms ?? onClose) : (onAcceptTerms ?? onClose),
                        disabled: isLoadingTos,
                        variant: 'purple',
                        className: 'w-full',
                        shadowSize: '4',
                    },
                    ...(!tosError
                        ? [
                              {
                                  text: 'Skip for now',
                                  onClick: onSkipTerms ?? onClose,
                                  variant: 'transparent' as const,
                                  className: 'underline text-sm font-medium w-full h-fit mt-3',
                              },
                          ]
                        : []),
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
