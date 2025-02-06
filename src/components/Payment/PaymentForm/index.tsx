'use client'

import { Button } from '@/components/0_Bruddle'
import FileUploadInput from '@/components/Global/FileUploadInput'
import FlowHeader from '@/components/Global/FlowHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { useState } from 'react'

interface PaymentFormProps {
    recipient: string
    amount?: string | null
    token?: string | null
    chain?: string | null
}

export const PaymentForm = ({ recipient, amount, token, chain }: PaymentFormProps) => {
    const dispatch = useAppDispatch()
    const [tokenValue, setTokenValue] = useState<string>(amount || '')
    const { selectedWallet, isWalletConnected } = useWallet()

    return (
        <div className="space-y-4">
            <FlowHeader />
            <div className="text-h6 font-bold">Sending to {recipient}</div>
            {/* <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header>
                    <Card.Title>Send Payment</Card.Title>
                    <Card.Description>Send payment to {recipient}</Card.Description>
                </Card.Header>
                <Card.Content className="flex flex-col gap-4"> */}
            {/* todo: prefill if amount present in url */}

            <TokenAmountInput
                tokenValue={tokenValue}
                setTokenValue={(value: string | undefined) => setTokenValue(value || '')}
                className="w-full"
            />

            {/* todo: render based on token value from url */}
            <TokenSelector />

            <FileUploadInput
                attachmentOptions={{
                    fileUrl: '',
                    message: '',
                    rawFile: undefined,
                }} // Provide a valid object or state
                setAttachmentOptions={() => {}} // Provide a valid function or state setter
            />

            <Button
                onClick={() => {
                    console.log('Pay Request Action')
                    dispatch(paymentActions.setView(2))
                }}
                disabled={!isWalletConnected || !tokenValue}
                className="w-full"
            >
                {!isWalletConnected ? 'Connect Wallet' : 'Pay'}
            </Button>
            {/* </Card.Content>
            </Card> */}
        </div>
    )
}
