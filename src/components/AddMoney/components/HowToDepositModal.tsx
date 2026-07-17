'use client'

import Modal from '@/components/Global/Modal'
import InfoCard from '@/components/Global/InfoCard'
import { useTranslations } from 'next-intl'

interface HowToDepositModalProps {
    visible: boolean
    onClose: () => void
    // offramp migration variant: walks the user through offramp.xyz's withdraw
    // flow instead of the generic wallet/exchange steps (which mention multiple
    // supported networks — contradicting the Arbitrum-only migration screen).
    variant?: 'default' | 'offramp'
}

const STEP_KEYS = ['step1', 'step2', 'step3', 'step4'] as const

const HowToDepositModal = ({ visible, onClose, variant = 'default' }: HowToDepositModalProps) => {
    const t = useTranslations('addMoney.howToDeposit')
    const isOfframp = variant === 'offramp'
    const steps = STEP_KEYS.map((key, index) => ({
        step: t('step', { number: index + 1 }),
        text: isOfframp ? t(`offramp.${key}`) : t(`default.${key}`),
    }))
    return (
        <Modal
            visible={visible}
            onClose={onClose}
            classWrap="sm:m-auto sm:self-center self-center m-4 bg-background rounded-sm"
        >
            <div className="flex flex-col gap-5 p-5">
                <h3 className={'text-start text-h6 font-bold text-black'}>
                    {isOfframp ? t('titleOfframp') : t('title')}
                </h3>
                <div className="flex flex-col overflow-hidden rounded-sm border border-black bg-white">
                    {steps.map((item, index) => (
                        <div
                            key={index}
                            className={`px-4 py-3 ${index !== steps.length - 1 ? 'border-b border-black' : ''}`}
                        >
                            <p className="text-sm font-bold">{item.step}</p>
                            <p className="text-sm text-grey-1">{item.text}</p>
                        </div>
                    ))}
                </div>

                <InfoCard variant="warning" icon="alert" title={isOfframp ? t('warningOfframp') : t('warning')} />
            </div>
        </Modal>
    )
}

export default HowToDepositModal
