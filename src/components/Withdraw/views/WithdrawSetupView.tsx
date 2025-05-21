'use client'

import { Button } from '@/components/0_Bruddle/Button'
import ErrorAlert from '@/components/Global/ErrorAlert'
import GeneralRecipientInput, { GeneralRecipientUpdate } from '@/components/Global/GeneralRecipientInput'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants'
import { loadingStateContext } from '@/context/loadingStates.context'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { ITokenPriceData, RecipientType } from '@/interfaces'
import { formatAmount } from '@/utils/general.utils'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import { useRouter } from 'next/navigation'
import { useContext, useEffect, useState } from 'react'

interface WithdrawSetupViewProps {
    amount: string
    onReview: (data: {
        token: ITokenPriceData
        chain: interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }
        address: string
    }) => void
    onBack?: () => void
    isProcessing?: boolean
}

export default function WithdrawSetupView({ amount, onReview, onBack, isProcessing }: WithdrawSetupViewProps) {
    const router = useRouter()
    const {
        selectedTokenData,
        selectedChainID,
        supportedSquidChainsAndTokens,
        setSelectedChainID,
        setSelectedTokenAddress,
    } = useContext(tokenSelectorContext)
    const [isValidRecipient, setIsValidRecipient] = useState(false)
    const [inputChanging, setInputChanging] = useState<boolean>(false)
    const [recipient, setRecipient] = useState<{ name: string | undefined; address: string }>({
        address: '',
        name: '',
    })
    const { setLoadingState, isLoading } = useContext(loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [_, setRecipientType] = useState<RecipientType>('address')

    const handleReview = () => {
        const selectedChainData = supportedSquidChainsAndTokens[selectedChainID]
        if (selectedTokenData && selectedChainData && recipient.address) {
            onReview({
                token: selectedTokenData,
                chain: selectedChainData,
                address: recipient.address,
            })
        } else {
            setErrorState({
                showError: true,
                errorMessage: 'Withdrawal details are missing',
            })
            console.error('Token, chain, or address not selected/entered')
        }
    }

    const defaultOnBack = () => {
        router.push('/withdraw')
    }

    // TODO: remove this once x-chain support is added
    // set the default token and chain for withdrawals (USDC on arb)
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
                    amount={formatAmount(amount)}
                    tokenSymbol={selectedTokenData?.symbol ?? ''}
                />

                {/* token selector is not needed for withdrawals right now, the only token peanut wallet supports is USDC on arb, this will be re-added once x-chain support is added */}
                {/* <TokenSelector viewType="withdraw" /> */}

                <GeneralRecipientInput
                    placeholder="Enter an address or ENS"
                    recipient={recipient}
                    onUpdate={(update: GeneralRecipientUpdate) => {
                        setRecipient(update.recipient)
                        if (!update.recipient.address) {
                            setRecipientType('address')
                            setLoadingState('Idle')
                        } else {
                            setRecipientType(update.type)
                        }
                        setIsValidRecipient(update.isValid)
                        setErrorState({
                            showError: !update.isValid,
                            errorMessage: update.errorMessage,
                        })
                        setInputChanging(update.isChanging)
                    }}
                    showInfoText={false}
                />

                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={handleReview}
                    disabled={
                        !selectedTokenData ||
                        !selectedChainID ||
                        !recipient.address ||
                        !!isLoading ||
                        !isValidRecipient ||
                        errorState.showError ||
                        inputChanging ||
                        isProcessing
                    }
                    loading={isProcessing}
                    className="w-full"
                >
                    {isProcessing ? 'Preparing...' : 'Review'}
                </Button>

                {errorState.showError && !!errorState.errorMessage && (
                    <ErrorAlert description={errorState.errorMessage} />
                )}
            </div>
        </div>
    )
}
