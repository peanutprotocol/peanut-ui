import { MERCADO_PAGO } from '@/assets'
import MantecaDetailsCard, { MantecaCardRow } from '@/components/Global/MantecaDetailsCard'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import ShareButton from '@/components/Global/ShareButton'
import { useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import { usePaymentStore } from '@/redux/hooks'
import React from 'react'

const MantecaFulfuilment = () => {
    const { setFulfilUsingManteca } = useRequestFulfillmentFlow()
    const { requestDetails, chargeDetails } = usePaymentStore()

    const rows: MantecaCardRow[] = [
        { key: 'cbu', label: 'CBU', value: '[CVU/ALIAS]', allowCopy: true },
        { key: 'alias', label: 'Alias', value: 'manurr.mp', hideBottomBorder: true },
    ]

    const generateShareText = () => {
        const textParts = []
        textParts.push(`CBU: ${rows[0].value}`)
        textParts.push(`Alias: ${rows[1].value}`)
        textParts.push(`Deposit Address: ${rows[2].value}`)

        return textParts.join('\n')
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8 md:min-h-fit">
            <NavHeader
                title="Send"
                onPrev={() => {
                    setFulfilUsingManteca(false)
                }}
            />

            <div className="my-auto space-y-4">
                <PeanutActionDetailsCard
                    avatarSize="medium"
                    transactionType="REQUEST_PAYMENT"
                    recipientType="USERNAME"
                    recipientName={requestDetails?.recipientAccount.user.username ?? ''}
                    amount={requestDetails?.tokenAmount ?? '0'}
                    tokenSymbol={requestDetails?.tokenSymbol || 'USDC'}
                    message={requestDetails?.reference || chargeDetails?.requestLink?.reference || ''}
                    fileUrl={requestDetails?.attachmentUrl || chargeDetails?.requestLink?.attachmentUrl || ''}
                    logo={MERCADO_PAGO}
                />

                <p className="font-bold">Account details</p>

                <MantecaDetailsCard rows={rows} />

                <ShareButton
                    generateText={async () => generateShareText()}
                    title="Account Details"
                    variant="purple"
                    className="w-full"
                >
                    Share Details
                </ShareButton>
            </div>
        </div>
    )
}

export default MantecaFulfuilment
