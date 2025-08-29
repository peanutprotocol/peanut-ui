'use client'

import ActionModal from '@/components/Global/ActionModal'
import { Slider } from '@/components/Slider'

interface OnrampConfirmationModalProps {
    visible: boolean
    onClose: () => void
    onConfirm: () => void
}

export const OnrampConfirmationModal = ({ visible, onClose, onConfirm }: OnrampConfirmationModalProps) => {
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="alert"
            iconContainerClassName="bg-yellow-400"
            iconProps={{ className: 'text-black' }}
            title="IMPORTANT!"
            description={
                <>
                    In the following step you'll see a <br /> <strong>"Deposit Message" item</strong> <br /> copy and
                    paste it exactly as it is on <br /> the description field of your transfer.
                    <br />
                    <br />
                    <strong>
                        Without it your deposit will be returned and might take 2-10 working days to process.
                    </strong>
                </>
            }
            footer={
                <div className="w-full">
                    <Slider onValueChange={(v) => v && onConfirm()} />
                </div>
            }
            preventClose={false}
            modalPanelClassName="max-w-md mx-8"
        />
    )
}
