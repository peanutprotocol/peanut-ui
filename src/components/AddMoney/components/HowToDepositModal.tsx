'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useTranslations } from 'next-intl'

interface HowToDepositModalProps {
    visible: boolean
    onClose: () => void
}

const STEP_KEYS = ['step1', 'step2', 'step3', 'step4'] as const

const HowToDepositModal = ({ visible, onClose }: HowToDepositModalProps) => {
    const t = useTranslations('addMoney.howToDeposit')
    const tCommon = useTranslations('common')
    // the marker carries the number now, so the "Step N" label goes
    const steps = STEP_KEYS.map((key) => t(`default.${key}`))
    return (
        <Drawer
            open={visible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    <DrawerHeader className="mb-3 w-full gap-2 p-0 text-center sm:text-center">
                        <DrawerTitle>{t('title')}</DrawerTitle>
                    </DrawerHeader>
                    <div className="flex w-full flex-col gap-4 text-left">
                        <NumberedList items={steps} />
                        {/* the one genuine risk on this screen keeps the single Notification slot */}
                        <Notification priority="attention">{t('warning')}</Notification>
                        <Button shadowSize="4" className="w-full justify-center" onClick={onClose}>
                            {tCommon('close')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default HowToDepositModal
