import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
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
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')
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
            title={isTerminal ? t('failedTitleTerminal') : t('failedTitleRetry')}
            description={!isTerminal && t('failedDescriptionRetry')}
            content={
                <div className="w-full">
                    <KycFailedContent rejectLabels={rejectLabels} isTerminal={isTerminal} />
                </div>
            }
            ctas={[
                isTerminal
                    ? {
                          text: tCommon('contactSupport'),
                          onClick: () => {
                              onClose()
                              setIsSupportModalOpen(true)
                          },
                          shadowSize: '4',
                      }
                    : {
                          text: tCommon(isLoading ? 'loading' : 'tryAgain'),
                          icon: 'retry',
                          onClick: onRetry,
                          disabled: isLoading,
                          shadowSize: '4',
                      },
            ]}
        />
    )
}
