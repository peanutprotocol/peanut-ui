'use client'

import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import GeneralRecipientInput, { GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { ITokenPriceData } from '@/interfaces'
import { formatAmount } from '@/utils/general.utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useRouter } from 'next/navigation'
import { useContext, useEffect, useMemo } from 'react'

interface CryptoWithdrawFormData {
    amount: string
    selectedToken: ITokenPriceData | null
    selectedChain: (peanutInterfaces.ISquidChain & { tokens: peanutInterfaces.ISquidToken[] }) | null
    recipientAddress: string
    isValidRecipient: boolean
}

interface CryptoWithdrawInitialProps {
    formData: CryptoWithdrawFormData
    updateFormDataAction: (updates: Partial<CryptoWithdrawFormData>) => void
    onNextAction: () => void
    isProcessing: boolean
    error: string | null
}

/**
 * CryptoWithdrawInitial View
 *
 * The initial step for crypto withdraw flow:
 * - Shows amount (from previous step)
 * - Token/chain selector
 * - Recipient address input
 * - Review button
 *
 * Reuses existing components - following DirectSend pattern!
 */
export const CryptoWithdrawInitial = ({
    formData,
    updateFormDataAction,
    onNextAction,
    isProcessing,
    error,
}: CryptoWithdrawInitialProps) => {
    const router = useRouter()
    const {
        selectedTokenData,
        selectedChainID,
        supportedSquidChainsAndTokens,
        setSelectedChainID,
        setSelectedTokenAddress,
    } = useContext(tokenSelectorContext)

    // Initialize with Peanut wallet defaults (like existing implementation)
    useEffect(() => {
        setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
        setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
    }, [setSelectedChainID, setSelectedTokenAddress])

    // Update form data when token selector changes
    useEffect(() => {
        if (selectedTokenData && supportedSquidChainsAndTokens[selectedChainID]) {
            updateFormDataAction({
                selectedToken: selectedTokenData,
                selectedChain: supportedSquidChainsAndTokens[selectedChainID],
            })
        }
    }, [selectedTokenData, selectedChainID, supportedSquidChainsAndTokens, updateFormDataAction])

    // Validation
    const canProceed = useMemo(() => {
        return (
            formData.selectedToken &&
            formData.selectedChain &&
            formData.recipientAddress &&
            formData.isValidRecipient &&
            formData.amount &&
            parseFloat(formData.amount) > 0 &&
            !isProcessing
        )
    }, [formData, isProcessing])

    const handleRecipientUpdate = (update: GeneralRecipientUpdate) => {
        updateFormDataAction({
            recipientAddress: update.recipient.address,
            isValidRecipient: update.isValid,
        })
    }

    return (
        <div className="space-y-8">
            <NavHeader title="Withdraw" onPrev={() => router.back()} />

            <div className="space-y-4">
                {/* Amount Display Card - Reusing existing component! */}
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType="WITHDRAW"
                    recipientType="USERNAME"
                    recipientName=""
                    amount={formatAmount(parseFloat(formData.amount || '0'))}
                    tokenSymbol="USDC"
                />

                {/* Token/Chain Selector - Reusing existing component! */}
                <TokenSelector viewType="withdraw" />

                {/* Recipient Address Input - Reusing existing component! */}
                <GeneralRecipientInput
                    placeholder="Enter an address or ENS"
                    recipient={{
                        name: undefined,
                        address: formData.recipientAddress,
                    }}
                    onUpdate={handleRecipientUpdate}
                    showInfoText={false}
                    isWithdrawal
                />

                {/* Review Button */}
                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={onNextAction}
                    disabled={!canProceed}
                    loading={isProcessing}
                    className="w-full"
                >
                    {isProcessing ? 'Preparing...' : 'Review'}
                </Button>

                {/* Error Display - Reusing existing component! */}
                {error && <ErrorAlert description={error} />}
            </div>
        </div>
    )
}
