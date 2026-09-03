import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { RejectLabelsList } from '../RejectLabelsList'

interface KycActionRequiredModalProps {
    visible: boolean
    onClose: () => void
    onResubmit: () => void
    isLoading?: boolean
    rejectLabels?: string[] | null
}

// shown when user clicks a locked region while their kyc needs resubmission (soft reject)
export const KycActionRequiredModal = ({
    visible,
    onClose,
    onResubmit,
    isLoading,
    rejectLabels,
}: KycActionRequiredModalProps) => {
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')

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
                        <DrawerTitle>{t('actionRequiredTitle')}</DrawerTitle>
                        <DrawerDescription>{t('actionRequiredDescription')}</DrawerDescription>
                    </DrawerHeader>
                    <div className="w-full text-left">
                        <RejectLabelsList rejectLabels={rejectLabels} />
                    </div>
                    <Button
                        icon="retry"
                        shadowSize="4"
                        className="w-full justify-center"
                        disabled={isLoading}
                        onClick={onResubmit}
                    >
                        {tCommon(isLoading ? 'loading' : 'continue')}
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
