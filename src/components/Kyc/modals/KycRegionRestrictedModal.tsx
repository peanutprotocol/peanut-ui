import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { KycRegionRestrictedContent, useRegionRestrictedCta } from '../KycRegionRestrictedContent'

interface KycRegionRestrictedModalProps {
    visible: boolean
    onClose: () => void
}

/**
 * Terminal rejection caused by the document's jurisdiction.
 *
 * Deliberately takes no `onRetry` and no `onContactSupport` — the two endings
 * this screen exists to replace. Not offering them is the feature, so they are
 * absent from the props rather than merely unused, and a future caller cannot
 * quietly reintroduce either one.
 */
export const KycRegionRestrictedModal = ({ visible, onClose }: KycRegionRestrictedModalProps) => {
    const t = useTranslations('kyc.regionRestricted')
    const cta = useRegionRestrictedCta(onClose)

    return (
        <Drawer
            open={visible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center px-4 pt-1 pb-6 text-center">
                    {/* DrawerHeader carries the M/12; the cta keeps the L/16 of the outer stack */}
                    <div className="flex w-full flex-col items-center gap-4">
                        <IconBubble icon="globe-lock" className="bg-action-primary" />
                        <DrawerHeader className="mb-3 w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('title')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="w-full">
                        <KycRegionRestrictedContent />
                    </div>
                    <Button
                        variant="purple"
                        shadowSize="4"
                        className="mt-4 w-full justify-center"
                        onClick={cta.onClick}
                    >
                        {cta.label}
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
