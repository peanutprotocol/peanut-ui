import { useMemo } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import InfoCard from '@/components/Global/InfoCard'
import { RejectLabelsList } from '../RejectLabelsList'
import { isTerminalRejection } from '@/constants/sumsub-reject-labels.consts'
import { useModalsContext } from '@/context/ModalsContext'

interface KycRejectedModalProps {
    visible: boolean
    onClose: () => void
    onRetry: () => void
    isLoading?: boolean
    rejectLabels?: string[] | null
    rejectType?: 'RETRY' | 'FINAL' | null
    failureCount?: number
}

// shown when user clicks a locked region while their kyc is rejected
export const KycRejectedModal = ({
    visible,
    onClose,
    onRetry,
    isLoading,
    rejectLabels,
    rejectType,
    failureCount,
}: KycRejectedModalProps) => {
    const { setIsSupportModalOpen } = useModalsContext()

    const isTerminal = useMemo(
        () => isTerminalRejection({ rejectType, failureCount, rejectLabels }),
        [rejectType, failureCount, rejectLabels]
    )

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon={isTerminal ? 'lock' : 'alert'}
            iconContainerClassName={isTerminal ? 'bg-red-1' : 'bg-yellow-1'}
            title={isTerminal ? 'Verification failed' : 'Verification unsuccessful'}
            description={
                isTerminal
                    ? 'Your verification cannot be retried.'
                    : 'Your verification was not successful. You can try again.'
            }
            content={
                <div className="w-full space-y-3">
                    <RejectLabelsList rejectLabels={rejectLabels} />
                    {isTerminal && (
                        <InfoCard
                            variant="error"
                            icon="lock"
                            description="Your verification cannot be retried. Please contact support for help."
                        />
                    )}
                </div>
            }
            ctas={[
                isTerminal
                    ? {
                          text: 'Contact support',
                          onClick: () => {
                              onClose()
                              setIsSupportModalOpen(true)
                          },
                          shadowSize: '4',
                      }
                    : {
                          text: isLoading ? 'Loading...' : 'Retry verification',
                          icon: 'retry',
                          onClick: onRetry,
                          disabled: isLoading,
                          shadowSize: '4',
                      },
            ]}
        />
    )
}
