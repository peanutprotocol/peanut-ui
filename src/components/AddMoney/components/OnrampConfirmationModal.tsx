'use client'

import ActionModal from '@/components/Global/ActionModal'
import { Icon } from '@/components/Global/Icons/Icon'
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
                    <InfoCard variant="default">
                        <ol className="mr-auto list-inside list-disc space-y-1 text-left text-sm">
                            <li>Bank details to send money to</li>
                            <li>A deposit reference code</li>
                        </ol>
                    </InfoCard>
                    <h2 className="mr-auto font-bold">You MUST:</h2>
                    <InfoCard variant="info">
                        <div className="flex items-center justify-start gap-2">
                            <Icon name="check" width={16} height={16} className="text-secondary-7" />
                            <span className="text-xs md:text-sm">
                                Send exactly{' '}
                                <b>
                                    {currency}
                                    {amount}{' '}
                                </b>
                                (the exact amount shown)
                            </span>
                        </div>

                        <div className="flex items-center justify-start gap-2">
                            <Icon name="check" width={16} height={16} className="text-secondary-7" />
                            <span className="text-xs md:text-sm">Copy the reference code exactly</span>
                        </div>
                        <div className="flex items-center justify-start gap-2">
                            <Icon name="check" width={16} height={16} className="text-secondary-7" />
                            <span className="text-xs md:text-sm">Paste it in the description/reference field</span>
                        </div>
                    </InfoCard>

                    <InfoCard variant="error">
                        <div className="flex w-full items-start justify-center gap-2">
                            <Icon name="alert" width={30} height={30} className="text-error-5" />
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-start text-xs font-bold md:text-sm">
                                    If the amount or reference don't match:
                                </span>
                                <span className="text-start text-xs md:text-sm">
                                    Your deposit will fail and it will take 2 to 10 days to return to your bank and
                                    might incur fees.
                                </span>
                            </div>
                        </div>
                    </InfoCard>
                </div>
            }
            preventClose={false}
            modalPanelClassName="max-w-md mx-8"
        />
    )
}
