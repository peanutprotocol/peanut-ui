import { useMemo } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import { KycFailedContent } from '../KycFailedContent'
import { isTerminalRejection } from '@/constants/sumsub-reject-labels.consts'
import { useModalsContext } from '@/context/ModalsContext'

interface KycFailedModalProps {
    visible: boolean
    onClose: () => void
    onRetry: () => void
    isLoading?: boolean
    rejectLabels?: string[] | null
    rejectType?: 'RETRY' | 'FINAL' | null
    failureCount?: number
}

// shown when user clicks a locked region while their kyc is rejected
export const KycFailedModal = ({
    visible,
    onClose,
    onRetry,
    isLoading,
    rejectLabels,
    rejectType,
    failureCount,
}: KycFailedModalProps) => {
    const { setIsSupportModalOpen } = useModalsContext()

    const isTerminal = useMemo(
        () => isTerminalRejection({ rejectType, failureCount, rejectLabels }),
        [rejectType, failureCount, rejectLabels]
    )

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon={'alert'}
            iconContainerClassName="bg-yellow-1"
            title={isTerminal ? 'Verification failed' : 'Verification unsuccessful'}
            description={!isTerminal && 'Your verification was not successful. You can try again.'}
            content={
                <div className="w-full">
                    <KycFailedContent rejectLabels={rejectLabels} isTerminal={isTerminal} />
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
