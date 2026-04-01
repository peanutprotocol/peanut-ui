'use client'

import Modal from '@/components/Global/Modal'
import InfoCard from '@/components/Global/InfoCard'

interface HowToDepositModalProps {
    visible: boolean
    onClose: () => void
}

const STEPS = [
    { step: 'Step 1', text: 'Copy your deposit address above' },
    { step: 'Step 2', text: 'Open your wallet or exchange and start a withdrawal' },
    { step: 'Step 3', text: 'Paste the address and select one of the supported networks' },
    { step: 'Step 4', text: 'Confirm and send — funds arrive within a few minutes' },
]

const HowToDepositModal = ({ visible, onClose }: HowToDepositModalProps) => {
    return (
        <Modal
            visible={visible}
            onClose={onClose}
            classWrap="sm:m-auto sm:self-center self-center m-4 bg-background rounded-sm"
        >
            <div className="flex flex-col gap-5 p-5">
                <h3 className={'text-start text-h6 font-bold text-black'}>How to Deposit</h3>
                <div className="flex flex-col overflow-hidden rounded-sm border border-black bg-white">
                    {STEPS.map((item, index) => (
                        <div
                            key={index}
                            className={`px-4 py-3 ${index !== STEPS.length - 1 ? 'border-b border-black' : ''}`}
                        >
                            <p className="text-sm font-bold">{item.step}</p>
                            <p className="text-sm text-grey-1">{item.text}</p>
                        </div>
                    ))}
                </div>

                <InfoCard
                    variant="warning"
                    icon="alert"
                    title="Sending to the wrong network or token will result in permanent loss."
                />
            </div>
        </Modal>
    )
}

export default HowToDepositModal
