'use client'

import ActionModal from '@/components/Global/ActionModal'
import { Notification } from '@/components/0_Bruddle/Notification'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
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
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={t('title')}
            ctas={[
                {
                    text: tCommon('close'),
                    shadowSize: '4',
                    onClick: onClose,
                },
            ]}
            content={
                <div className="flex w-full flex-col gap-4 text-left">
                    <NumberedList items={steps} />
                    {/* the one genuine risk on this screen keeps the single Notification slot */}
                    <Notification priority="attention">{t('warning')}</Notification>
                </div>
            }
        />
    )
}

export default HowToDepositModal
