'use client'

import ActionModal from '@/components/Global/ActionModal'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useTranslations } from 'next-intl'

interface HowToDepositModalProps {
    visible: boolean
    onClose: () => void
}

const STEP_KEYS = ['step1', 'step2', 'step3', 'step4'] as const

const HowToDepositModal = ({ visible, onClose }: HowToDepositModalProps) => {
    const t = useTranslations('addMoney.howToDeposit')
    const steps = STEP_KEYS.map((key, index) => ({
        step: t('step', { number: index + 1 }),
        text: t(`default.${key}`),
    }))
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={t('title')}
            content={
                <div className="flex w-full flex-col gap-4 text-left">
                    <div className="flex flex-col overflow-hidden rounded-sm border border-border-default bg-background-default">
                        {steps.map((item, index) => (
                            <div
                                key={index}
                                className={`px-4 py-3 ${index !== steps.length - 1 ? 'border-b border-border-default' : ''}`}
                            >
                                <p className="text-label-l">{item.step}</p>
                                <p className="text-body-s text-foreground-secondary">{item.text}</p>
                            </div>
                        ))}
                    </div>

                    <Notification priority="attention">{t('warning')}</Notification>
                </div>
            }
        />
    )
}

export default HowToDepositModal
