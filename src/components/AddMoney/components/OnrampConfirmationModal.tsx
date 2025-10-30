'use client'

import ActionModal from '@/components/Global/ActionModal'
import InfoCard from '@/components/Global/InfoCard'
import { Slider } from '@/components/Slider'

interface OnrampConfirmationModalProps {
    visible: boolean
    onClose: () => void
    onConfirm: () => void
    amount: string
    currency: string
}

export const OnrampConfirmationModal = ({
    visible,
    onClose,
    onConfirm,
    amount,
    currency,
}: OnrampConfirmationModalProps) => {
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="alert"
            iconContainerClassName="bg-yellow-400"
            iconProps={{ className: 'text-black' }}
            title="IMPORTANT!"
            footer={
                <div className="w-full">
                    <Slider onValueChange={(v) => v && onConfirm()} />
                </div>
            }
            content={
                <div className="flex w-full flex-col gap-4">
                    <InfoCard variant="default" items={['Bank details to send money to', 'A deposit reference code']} />
                    <h2 className="mr-auto font-bold">You MUST:</h2>
                    <InfoCard
                        variant="info"
                        itemIcon="check"
                        itemIconClassName="text-secondary-7"
                        items={[
                            <>
                                Send exactly{' '}
                                <b>
                                    {currency}
                                    {amount}
                                </b>{' '}
                                (the exact amount shown)
                            </>,
                            'Copy the reference code exactly',
                            'Paste it in the description/reference field',
                        ]}
                    />

                    <InfoCard
                        variant="error"
                        icon="alert"
                        iconClassName="text-error-5"
                        title="If the amount or reference don't match:"
                        description="Your deposit will fail and it will take 2 to 10 days to return to your bank and might incur fees."
                    />
                </div>
            }
            preventClose={false}
            modalPanelClassName="max-w-md mx-8"
        />
    )
}
