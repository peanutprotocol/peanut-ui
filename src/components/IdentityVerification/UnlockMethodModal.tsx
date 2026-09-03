'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import KycPrepChecklist, { type KycPrepPath } from '@/components/Kyc/KycPrepChecklist'
import { PeanutDoesntStoreAnyPersonalInformation } from '@/components/Kyc/PeanutDoesntStoreAnyPersonalInformation'

interface UnlockMethodModalProps {
    visible: boolean
    onClose: () => void
    onUnlock: () => void
    /** Display label of the tapped method row (already localized). */
    methodLabel: string | null
    /** Which prep checklist applies: extended for Manteca (BR/AR), standard elsewhere. */
    path?: KycPrepPath
    isLoading?: boolean
}

/**
 * Method-worded unlock sheet for the Unlock payments screen. The tap promised
 * a product ("SEPA transfers · Unlock"), so the sheet speaks about that
 * product — never about regions. The body is the prep checklist: what to have
 * ready and how long it takes, stated BEFORE the SDK opens, so nobody starts
 * the check and then goes hunting for documents halfway through.
 */
const UnlockMethodModal = ({
    visible,
    onClose,
    onUnlock,
    methodLabel,
    path = 'standard',
    isLoading,
}: UnlockMethodModalProps) => {
    const t = useTranslations('profile.unlockPayments.unlockModal')
    const tPrep = useTranslations('kyc.prep')
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
                    <IconBubble icon="shield" className="bg-action-primary" />
                    <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                        <DrawerTitle>
                            {methodLabel ? t('title', { method: methodLabel }) : t('titleGeneric')}
                        </DrawerTitle>
                    </DrawerHeader>
                    {/* the checklist is the body — left-aligned like the modal's descriptionClassName override */}
                    <div className="w-full text-left">
                        <KycPrepChecklist path={path} />
                    </div>
                    <Button
                        icon="check-circle"
                        shadowSize="4"
                        variant="purple"
                        className="w-full justify-center"
                        disabled={isLoading}
                        onClick={onUnlock}
                    >
                        {isLoading ? tCommon('loading') : tPrep('startCta')}
                    </Button>
                    <Button variant="stroke" className="w-full justify-center" onClick={onClose}>
                        {t('notNow')}
                    </Button>
                    <PeanutDoesntStoreAnyPersonalInformation className="w-full justify-center" />
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default UnlockMethodModal
