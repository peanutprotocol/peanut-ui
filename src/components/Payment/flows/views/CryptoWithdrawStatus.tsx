'use client'

import AddressLink from '@/components/Global/AddressLink'
import DirectSuccessView from '@/components/Payment/Views/Status.payment.view'
import { useCryptoWithdrawFlow } from '@/hooks/payment'
import { ITokenPriceData } from '@/interfaces'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'

interface CryptoWithdrawFormData {
    amount: string
    selectedToken: ITokenPriceData | null
    selectedChain: (peanutInterfaces.ISquidChain & { tokens: peanutInterfaces.ISquidToken[] }) | null
    recipientAddress: string
    isValidRecipient: boolean
}

interface CryptoWithdrawStatusProps {
    formData: CryptoWithdrawFormData
    cryptoWithdrawHook: ReturnType<typeof useCryptoWithdrawFlow>
    onCompleteAction: () => void
    onWithdrawAnotherAction: () => void
}

/**
 * CryptoWithdrawStatus View
 *
 * The success step for crypto withdraw flow - uses DirectSuccessView to match original design exactly.
 */
export const CryptoWithdrawStatus = ({
    formData,
    cryptoWithdrawHook,
    onCompleteAction,
    onWithdrawAnotherAction,
}: CryptoWithdrawStatusProps) => {
    return (
        <DirectSuccessView
            headerTitle="Withdraw"
            recipientType="ADDRESS"
            type="SEND"
            amount={formData.amount}
            isWithdrawFlow={true}
            redirectTo="/home"
            message={
                <AddressLink
                    className="text-sm font-normal text-grey-1 no-underline"
                    address={formData.recipientAddress}
                />
            }
        />
    )
}
