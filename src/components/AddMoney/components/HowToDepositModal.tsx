'use client'

import Modal from '@/components/Global/Modal'
import InfoCard from '@/components/Global/InfoCard'

interface HowToDepositModalProps {
    visible: boolean
    onClose: () => void
    // offramp migration variant: walks the user through offramp.xyz's withdraw
    // flow instead of the generic wallet/exchange steps (which mention multiple
    // supported networks — contradicting the Arbitrum-only migration screen).
    variant?: 'default' | 'offramp'
}

const STEPS = [
    { step: 'Step 1', text: 'Copy your deposit address above' },
    { step: 'Step 2', text: 'Open your wallet or exchange and start a withdrawal' },
    { step: 'Step 3', text: 'Paste the address and select one of the supported networks' },
    { step: 'Step 4', text: 'Confirm and send — funds arrive within a few minutes' },
]

const OFFRAMP_STEPS = [
    { step: 'Step 1', text: 'Copy your migration deposit address above' },
    { step: 'Step 2', text: 'Open your Offramp account and start a withdrawal or send' },
    { step: 'Step 3', text: 'Choose USDC on the Arbitrum network and paste the address' },
    { step: 'Step 4', text: 'Confirm and send — your balance arrives within a few minutes' },
]

const HowToDepositModal = ({ visible, onClose, variant = 'default' }: HowToDepositModalProps) => {
    const isOfframp = variant === 'offramp'
    const steps = isOfframp ? OFFRAMP_STEPS : STEPS
    return (
        <Modal
            visible={visible}
            onClose={onClose}
            classWrap="sm:m-auto sm:self-center self-center m-4 bg-background rounded-sm"
        >
            <div className="flex flex-col gap-5 p-5">
                <h3 className={'text-start text-h6 font-bold text-black'}>
                    {isOfframp ? 'How to Migrate' : 'How to Deposit'}
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

                <InfoCard
                    variant="warning"
                    icon="alert"
                    title={
                        isOfframp
                            ? 'Only send USDC on Arbitrum — other tokens or networks may be lost.'
                            : 'Sending to the wrong network or token will result in permanent loss.'
                    }
                />
            </div>
        </Modal>
    )
}

export default HowToDepositModal
