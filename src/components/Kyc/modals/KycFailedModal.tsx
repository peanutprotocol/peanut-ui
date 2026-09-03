import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
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
        <Drawer
            open={visible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center gap-4 px-4 pt-1 pb-6 text-center">
                    <IconBubble icon="alert" color="yellow" />
                    <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                        <DrawerTitle>{isTerminal ? t('failedTitleTerminal') : t('failedTitleRetry')}</DrawerTitle>
                        {!isTerminal && <DrawerDescription>{t('failedDescriptionRetry')}</DrawerDescription>}
                    </DrawerHeader>
                    <div className="w-full text-left">
                        <KycFailedContent rejectLabels={rejectLabels} isTerminal={isTerminal} />
                    </div>
                    {isTerminal ? (
                        <Button
                            shadowSize="4"
                            className="w-full justify-center"
                            onClick={() => {
                                onClose()
                                setIsSupportModalOpen(true)
                            }}
                        >
                            {tCommon('contactSupport')}
                        </Button>
                    ) : (
                        <Button
                            icon="retry"
                            shadowSize="4"
                            className="w-full justify-center"
                            disabled={isLoading}
                            onClick={onRetry}
                        >
                            {tCommon(isLoading ? 'loading' : 'tryAgain')}
                        </Button>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
