import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'

interface KycProcessingModalProps {
    visible: boolean
    onClose: () => void
}

// shown when user clicks a locked region while their kyc is pending/in review
export const KycProcessingModal = ({ visible, onClose }: KycProcessingModalProps) => {
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
                    <IconBubble icon="clock" color="yellow" />
                    <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                        <DrawerTitle>{t('processingTitle')}</DrawerTitle>
                        <DrawerDescription>{t('processingDescription')}</DrawerDescription>
                    </DrawerHeader>
                    <Button shadowSize="4" className="w-full justify-center" onClick={onClose}>
                        {tCommon('gotIt')}
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
