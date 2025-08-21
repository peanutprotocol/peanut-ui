'use client'

import { Button } from '@/components/0_Bruddle/Button'
import ErrorAlert from '@/components/Global/ErrorAlert'
import GeneralRecipientInput, { GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { ITokenPriceData } from '@/interfaces'
import { formatAmount } from '@/utils/general.utils'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { useRouter } from 'next/navigation'
import { useContext, useEffect } from 'react'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'

interface InitialWithdrawViewProps {
    amount: string
    onReview: (data: {
        token: ITokenPriceData
        chain: interfaces.ISquidChain & { networkName: string; tokens: interfaces.ISquidToken[] }
        address: string
    }) => void
    onBack?: () => void
    isProcessing?: boolean
}

export default function InitialWithdrawView({ amount, onReview, onBack, isProcessing }: InitialWithdrawViewProps) {
    const { usdAmount } = useWithdrawFlow()
    const router = useRouter()
    const {
        selectedTokenData,
        selectedChainID,
        supportedSquidChainsAndTokens,
        setSelectedChainID,
        setSelectedTokenAddress,
    } = useContext(tokenSelectorContext)

    const {
        isValidRecipient,
        setIsValidRecipient,
        inputChanging,
        setInputChanging,
        recipient,
        setRecipient,
        error,
        setError,
    } = useWithdrawFlow()

    const handleReview = () => {
        const selectedChainData = supportedSquidChainsAndTokens[selectedChainID]
        if (selectedTokenData && selectedChainData && recipient.address) {
            onReview({
                token: selectedTokenData,
                chain: selectedChainData,
                address: recipient.address,
            })
        } else {
            setError({
                showError: true,
                errorMessage: 'Withdrawal details are missing',
            })
            console.error('Token, chain, or address not selected/entered')
        }
    }

    const defaultOnBack = () => {
        router.push('/withdraw')
    }

    useEffect(() => {
        setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
        setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
    }, [])

    return (
        <div className="space-y-8">
            <NavHeader title="Withdraw" onPrev={onBack || defaultOnBack} />

            <div className="space-y-4">
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType={'WITHDRAW'}
                    recipientType="USERNAME"
                    recipientName={''}
                    amount={`${formatAmount(parseFloat(usdAmount || amount))}`}
                    tokenSymbol="USDC"
                />

                <TokenSelector viewType="withdraw" />

                <GeneralRecipientInput
                    placeholder="Enter an address or ENS"
                    recipient={recipient}
                    onUpdate={(update: GeneralRecipientUpdate) => {
                        setRecipient(update.recipient)
                        setIsValidRecipient(update.isValid)
                        setError({
                            showError: !update.isValid,
                            errorMessage: update.errorMessage,
                        })
                        setInputChanging(update.isChanging)
                    }}
                    showInfoText={false}
                    isWithdrawal
                />

                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={handleReview}
                    disabled={
                        !selectedTokenData ||
                        !selectedChainID ||
                        !recipient.address ||
                        !isValidRecipient ||
                        error.showError ||
                        inputChanging ||
                        isProcessing
                    }
                    loading={isProcessing}
                    className="w-full"
                >
                    Review
                </Button>

                {error.showError && !!error.errorMessage && <ErrorAlert description={error.errorMessage} />}
            </div>
        </div>
    )
}
