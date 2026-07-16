import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
    onContinue,
    tosError,
    isLoadingTos,
    preparingTimedOut,
    preparingStage = 'initial',
}: KycVerificationInProgressModalProps) => {
    const router = useRouter()
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')

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
                title={t('progress.verifyingTitle')}
                description={<p>{t('progress.verifyingDescription')}</p>}
                ctas={[
                    {
                        text: tCommon('goToHome'),
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
                    title: t('progress.preparingTimedOutTitle'),
                    description: t('progress.preparingTimedOutDescription'),
                }
            }
            switch (preparingStage) {
                case 'configuring':
                    return {
                        title: t('progress.preparingTitle'),
                        description: t('progress.preparingConfiguringDescription'),
                    }
                case 'slow':
                    return {
                        title: t('progress.preparingSlowTitle'),
                        description: t('progress.preparingSlowDescription'),
                    }
                case 'initial':
                default:
                    return {
                        title: t('progress.preparingTitle'),
                        description: t('progress.preparingInitialDescription'),
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
                                  text: tCommon('goToHome'),
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
        const description = tosError || t('progress.bridgeTosDescription')

        return (
            <ActionModal
                visible={isOpen}
                onClose={onClose}
                icon={'check' as IconName}
                iconContainerClassName="bg-success-1 text-white"
                title={t('progress.bridgeTosTitle')}
                description={description}
                ctas={[
                    {
                        text: tosError ? tCommon('continue') : t('progress.acceptTerms'),
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
            title={t('progress.completeTitle')}
            description={t('progress.completeDescription')}
            ctas={[
                {
                    text: tCommon('continue'),
                    onClick: onContinue ?? onClose,
                    variant: 'purple',
                    className: 'w-full',
                    shadowSize: '4',
                },
            ]}
        />
    )
}
