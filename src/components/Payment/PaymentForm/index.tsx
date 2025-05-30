'use client'

import { fetchTokenPrice } from '@/app/actions/tokens'
import { Button } from '@/components/0_Bruddle'
import ActionModal from '@/components/Global/ActionModal'
import AddressLink from '@/components/Global/AddressLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FlowHeader from '@/components/Global/FlowHeader'
import GuestLoginCta from '@/components/Global/GuestLoginCta'
import { IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import BeerInput from '@/components/PintaReqPay/BeerInput'
import PintaReqViewWrapper from '@/components/PintaReqPay/PintaReqViewWrapper'
import UserCard from '@/components/User/UserCard'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_SYMBOL,
    PINTA_WALLET_CHAIN,
    PINTA_WALLET_TOKEN,
} from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useAuth } from '@/context/authContext'
import { InitiatePaymentPayload, usePaymentInitiator } from '@/hooks/usePaymentInitiator'
import { useWallet } from '@/hooks/wallet/useWallet'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { walletActions } from '@/redux/slices/wallet-slice'
import { areEvmAddressesEqual, ErrorHandler, formatAmount } from '@/utils'
import { useAppKit, useDisconnect } from '@reown/appkit/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'

export type PaymentFlowProps = {
    isPintaReq?: boolean
    isAddMoneyFlow?: boolean
    isDirectPay?: boolean
    currency?: {
        code: string
        symbol: string
        price: number
    }
    currencyAmount?: string
    setCurrencyAmount?: (currencyvalue: string | undefined) => void
}

export type PaymentFormProps = ParsedURL & PaymentFlowProps

export const PaymentForm = ({
    recipient,
    amount,
    token,
    chain,
    isPintaReq,
    currency,
    currencyAmount,
    setCurrencyAmount,
    isAddMoneyFlow,
    isDirectPay,
}: PaymentFormProps) => {
    const dispatch = useAppDispatch()
    const router = useRouter()
    const { user } = useAuth()
    const { requestDetails, chargeDetails, beerQuantity, error: paymentStoreError } = usePaymentStore()
    const { isConnected: isPeanutWallet, balance } = useWallet()
    const { isConnected: isWagmiConnected, status } = useAccount()
    const [initialSetupDone, setInitialSetupDone] = useState(false)
    const [inputTokenAmount, setInputTokenAmount] = useState<string>(
        chargeDetails?.tokenAmount || requestDetails?.tokenAmount || amount || ''
    )
    const [disconnectWagmiModal, setDisconnectWagmiModal] = useState<boolean>(false)
    const [inputUsdValue, setInputUsdValue] = useState<string>('')
    const [usdValue, setUsdValue] = useState<string>('')
    const [requestedTokenPrice, setRequestedTokenPrice] = useState<number>(0)
    const [_isFetchingTokenPrice, setIsFetchingTokenPrice] = useState<boolean>(false)

    const { initiatePayment, isProcessing, error: initiatorError } = usePaymentInitiator()

    const peanutWalletBalance = useMemo(() => {
        const formattedBalance = formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))
        return formattedBalance
    }, [balance])

    const error = useMemo(() => {
        if (paymentStoreError) return ErrorHandler(paymentStoreError)
        if (initiatorError) return ErrorHandler(initiatorError)
        return null
    }, [paymentStoreError, initiatorError])

    const {
        selectedTokenPrice,
        selectedChainID,
        selectedTokenAddress,
        selectedTokenData,
        setSelectedChainID,
        setSelectedTokenAddress,
        setSelectedTokenDecimals,
        selectedTokenBalance,
    } = useContext(tokenSelectorContext)
    const { open: openReownModal } = useAppKit()
    const { disconnect: disconnectWagmi } = useDisconnect()
    const { address: wagmiAddress } = useAccount()
    const searchParams = useSearchParams()
    const requestId = searchParams.get('id')
    const isDepositRequest = searchParams.get('action') === 'deposit'

    const isConnected = useMemo<boolean>(() => {
        return isPeanutWallet || isWagmiConnected
    }, [isPeanutWallet, isWagmiConnected, status])

    const isActivePeanutWallet = useMemo(() => !!user && isPeanutWallet, [user, isPeanutWallet])

    useEffect(() => {
        if (initialSetupDone) return

        if (amount) {
            setInputTokenAmount(amount)
        }

        if (chain) {
            setSelectedChainID((chain.chainId || requestDetails?.chainId) ?? '')
            if (!token && !requestDetails?.tokenAddress) {
                const defaultToken = chain.tokens.find((t) => t.symbol.toLowerCase() === 'usdc')
                if (defaultToken) {
                    setSelectedTokenAddress(defaultToken.address)
                    setSelectedTokenDecimals(defaultToken.decimals)
                }
            }
        }

        if (token) {
            setSelectedTokenAddress((token.address || requestDetails?.tokenAddress) ?? '')
            if (token.decimals) {
                setSelectedTokenDecimals(token.decimals)
            }
        }

        setInitialSetupDone(true)
    }, [chain, token, amount, initialSetupDone, requestDetails])

    // reset error when component mounts or recipient changes
    useEffect(() => {
        dispatch(paymentActions.setError(null))
    }, [dispatch, recipient])

    useEffect(() => {
        dispatch(paymentActions.setError(null))

        if (!inputTokenAmount || isNaN(parseFloat(inputTokenAmount)) || parseFloat(inputTokenAmount) <= 0) {
            // if input is invalid or zero, no balance check is needed yet, or clear error if it was for insufficient balance
            return
        }

        try {
            if (isAddMoneyFlow) {
                // ADD MONEY FLOW: Strictly check external wallet if connected
                if (isWagmiConnected && selectedTokenData && selectedTokenBalance !== undefined) {
                    if (selectedTokenData.decimals === undefined) {
                        console.error('Selected token has no decimals information for Add Money.')
                        dispatch(paymentActions.setError('Cannot verify balance: token data incomplete.'))
                        return
                    }
                    if (selectedTokenBalance < inputTokenAmount) {
                        dispatch(paymentActions.setError('Insufficient balance in connected wallet'))
                    } else {
                        dispatch(paymentActions.setError(null))
                    }
                } else {
                    // not connected or data missing for add money flow, clear error
                    dispatch(paymentActions.setError(null))
                }
            } else {
                // regular send/pay or PINTA flow
                if (isActivePeanutWallet && areEvmAddressesEqual(selectedTokenAddress, PEANUT_WALLET_TOKEN)) {
                    // peanut wallet payment
                    const walletNumeric = parseFloat(String(peanutWalletBalance).replace(/,/g, ''))
                    const inputNumeric = parseFloat(String(inputTokenAmount).replace(/,/g, ''))
                    if (walletNumeric < inputNumeric) {
                        dispatch(paymentActions.setError('Insufficient balance'))
                    } else {
                        dispatch(paymentActions.setError(null))
                    }
                } else if (
                    isWagmiConnected &&
                    !isActivePeanutWallet &&
                    selectedTokenData &&
                    selectedTokenBalance !== undefined
                ) {
                    // external wallet payment (not add money flow)
                    if (selectedTokenData.decimals === undefined) {
                        console.error('Selected token has no decimals information.')
                        dispatch(paymentActions.setError('Cannot verify balance: token data incomplete.'))
                        return
                    }
                    if (selectedTokenBalance < inputTokenAmount) {
                        dispatch(paymentActions.setError('Insufficient balance'))
                    } else {
                        dispatch(paymentActions.setError(null))
                    }
                } else {
                    dispatch(paymentActions.setError(null))
                }
            }
        } catch (e) {
            console.error('Error during balance check:', e)
            if (
                e instanceof Error &&
                (e.message.toLowerCase().includes('invalid character') ||
                    e.message.toLowerCase().includes('invalid BigInt value'))
            ) {
                dispatch(paymentActions.setError('Invalid amount for balance check'))
            } else {
                dispatch(paymentActions.setError('Error verifying balance'))
            }
        }
    }, [
        selectedTokenBalance,
        peanutWalletBalance,
        selectedTokenAddress,
        inputTokenAmount,
        isActivePeanutWallet,
        dispatch,
        selectedTokenData,
        isWagmiConnected,
        isAddMoneyFlow,
    ])

    // fetch token price
    useEffect(() => {
        if (isPintaReq) return
        if (!requestDetails?.tokenAddress || !requestDetails?.chainId) return

        const getTokenPriceData = async () => {
            setIsFetchingTokenPrice(true)
            try {
                const priceData = await fetchTokenPrice(requestDetails.tokenAddress, requestDetails.chainId)

                if (priceData) {
                    setRequestedTokenPrice(priceData.price)

                    if (requestDetails?.tokenAmount) {
                        // calculate USD value
                        const tokenAmount = parseFloat(requestDetails.tokenAmount)
                        const usdValue = formatAmount(tokenAmount * priceData.price)
                        setInputTokenAmount(usdValue)
                        setUsdValue(usdValue)
                    }
                } else {
                    console.log('Failed to fetch token price data')
                }
            } catch (error) {
                console.error('Error fetching token price:', error)
            } finally {
                setIsFetchingTokenPrice(false)
            }
        }

        getTokenPriceData()
    }, [requestDetails, isPintaReq])

    const canInitiatePayment = useMemo<boolean>(() => {
        let amountIsSet = false
        if (isPintaReq) {
            amountIsSet = beerQuantity > 0
        } else if (isActivePeanutWallet) {
            amountIsSet = !!inputTokenAmount && parseFloat(inputTokenAmount) > 0
        } else {
            amountIsSet =
                (!!inputTokenAmount && parseFloat(inputTokenAmount) > 0) || (!!usdValue && parseFloat(usdValue) > 0)
        }

        const tokenSelected = !!selectedTokenAddress && !!selectedChainID
        const recipientExists = !!recipient
        const walletConnected = isConnected

        return recipientExists && amountIsSet && tokenSelected && walletConnected
    }, [
        recipient,
        inputTokenAmount,
        usdValue,
        selectedTokenAddress,
        selectedChainID,
        isPintaReq,
        beerQuantity,
        isConnected,
        isActivePeanutWallet,
    ])

    const handleInitiatePayment = useCallback(async () => {
        if (!isWagmiConnected && isAddMoneyFlow) {
            openReownModal()
            return
        }

        if (!isConnected) {
            dispatch(walletActions.setSignInModalVisible(true))
            return
        }

        if (!canInitiatePayment) return

        // for PINTA requests, validate beer quantity first
        if (isPintaReq) {
            if (beerQuantity <= 0) {
                dispatch(paymentActions.setError('Please select at least 1 beer to continue.'))
                return
            }

            try {
                const payload = {
                    recipient: recipient,
                    tokenAmount: beerQuantity.toString(),
                    isPintaReq: true,
                    requestId: requestId ?? undefined,
                    chainId: PINTA_WALLET_CHAIN.id.toString(),
                    tokenAddress: PINTA_WALLET_TOKEN,
                }

                console.log('Initiating PINTA payment with payload:', payload)

                const result = await initiatePayment(payload)

                if (result.status === 'Success') {
                    dispatch(paymentActions.setView('STATUS'))
                } else if (result.status === 'Charge Created') {
                    dispatch(paymentActions.setView('CONFIRM'))
                } else if (result.status === 'Error') {
                    console.error('PINTA payment initiation failed:', result.error)
                }
                return
            } catch (error) {
                console.error('Failed to initiate PINTA payment:', error)
                const errorString = ErrorHandler(error)
                dispatch(paymentActions.setError(errorString))
                return
            }
        }

        // regular payment flow
        if (!inputTokenAmount || parseFloat(inputTokenAmount) <= 0) {
            console.error('Invalid amount entered')
            dispatch(paymentActions.setError('Please enter a valid amount'))
            return
        }

        if (!isActivePeanutWallet && isWagmiConnected && selectedTokenData && selectedChainID && !!chargeDetails) {
            dispatch(paymentActions.setView('CONFIRM'))
            return
        }

        dispatch(paymentActions.setError(null))

        const requestedToken = chargeDetails?.tokenAddress ?? requestDetails?.tokenAddress
        const requestedChain = chargeDetails?.chainId ?? requestDetails?.chainId
        let tokenAmount = inputTokenAmount
        if (
            requestedToken &&
            requestedTokenPrice &&
            (requestedChain !== selectedChainID || !areEvmAddressesEqual(requestedToken, selectedTokenAddress))
        ) {
            tokenAmount = (parseFloat(inputUsdValue) / requestedTokenPrice).toString()
        }

        const payload: InitiatePaymentPayload = {
            recipient: recipient,
            tokenAmount,
            isPintaReq: false, // explicitly set to false for non-PINTA requests
            requestId: requestId ?? undefined,
            chargeId: chargeDetails?.uuid,
            currency,
            currencyAmount,
            isAddMoneyFlow: !!isAddMoneyFlow,
            transactionType: isAddMoneyFlow ? 'DEPOSIT' : isDirectPay ? 'DIRECT_SEND' : 'REQUEST',
        }

        console.log('Initiating payment with payload:', payload)

        const result = await initiatePayment(payload)

        if (result.status === 'Success') {
            dispatch(paymentActions.setView('STATUS'))
        } else if (result.status === 'Charge Created') {
            dispatch(paymentActions.setView('CONFIRM'))
        } else if (result.status === 'Error') {
            console.error('Payment initiation failed:', result.error)
        } else {
            console.warn('Unexpected status from usePaymentInitiator:', result.status)
        }
    }, [
        canInitiatePayment,
        isDepositRequest,
        isConnected,
        openReownModal,
        recipient,
        inputTokenAmount,
        isPintaReq,
        requestId,
        initiatePayment,
        beerQuantity,
        chargeDetails,
        isAddMoneyFlow,
        requestDetails,
        selectedTokenAddress,
        selectedChainID,
        inputUsdValue,
        requestedTokenPrice,
    ])

    const getButtonText = () => {
        if (!isWagmiConnected && isAddMoneyFlow) {
            return 'Connect Wallet'
        }

        if (isAddMoneyFlow) {
            return 'Review'
        }

        if (isProcessing) {
            return 'Send'
        }

        if (isActivePeanutWallet) {
            return 'Send'
        }

        return 'Review'
    }

    const getButtonIcon = (): IconName | undefined => {
        if (!isWagmiConnected && isAddMoneyFlow) return 'wallet-outline'

        if (!isProcessing && isActivePeanutWallet && !isAddMoneyFlow) return 'arrow-up-right'

        return undefined
    }

    const guestAction = () => {
        if (isConnected || user) return null
        return (
            <div className="space-y-4">
                <Button variant="purple" shadowSize="4" onClick={() => router.push('/setup')} className="w-full">
                    Sign In
                </Button>
                <Button variant="primary-soft" shadowSize="4" onClick={() => openReownModal()} className="w-full">
                    Connect Wallet
                </Button>
            </div>
        )
    }

    useEffect(() => {
        if (isPintaReq && inputTokenAmount) {
            dispatch(paymentActions.setBeerQuantity(Number(inputTokenAmount)))
        }
    }, [isPintaReq, inputTokenAmount, dispatch])

    useEffect(() => {
        if (!inputTokenAmount) return
        if (selectedTokenPrice) {
            setUsdValue((parseFloat(inputTokenAmount) * selectedTokenPrice).toString())
        }
    }, [inputTokenAmount, selectedTokenPrice])

    // Initialize inputTokenAmount
    useEffect(() => {
        if (amount && !inputTokenAmount && !initialSetupDone) {
            setInputTokenAmount(amount)
        }
    }, [amount, inputTokenAmount, initialSetupDone])

    // Init beer quantity
    useEffect(() => {
        if (!inputTokenAmount) return
        if (isPintaReq) {
            dispatch(paymentActions.setBeerQuantity(Number(inputTokenAmount)))
        }
    }, [isPintaReq, inputTokenAmount])

    const isXChainPeanutWalletReq = useMemo(() => {
        if (!isActivePeanutWallet || !selectedTokenData) return false

        const isSupportedChain = selectedChainID === PEANUT_WALLET_CHAIN.id.toString()
        const isSupportedToken = selectedTokenAddress.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase()

        return !(isSupportedChain && isSupportedToken)
    }, [isActivePeanutWallet, selectedChainID, selectedTokenAddress, selectedTokenData])

    const isButtonDisabled = useMemo(() => {
        if (isProcessing) return true
        if (!!error) return true

        // ensure inputTokenAmount is a valid positive number before allowing payment
        const numericAmount = parseFloat(inputTokenAmount)
        if (isNaN(numericAmount) || numericAmount <= 0) {
            if (!isAddMoneyFlow) return true
        }

        if (isAddMoneyFlow) {
            if (!isWagmiConnected) return false // "Connect Wallet" button should be active
            return (
                !inputTokenAmount ||
                isNaN(parseFloat(inputTokenAmount)) ||
                parseFloat(inputTokenAmount) <= 0 ||
                !selectedTokenAddress ||
                !selectedChainID ||
                isProcessing
            )
        }

        // logic for non-AddMoneyFlow / non-Pinta (Pinta has its own button logic)
        if (!isPintaReq) {
            if (!isConnected) return true // if not connected at all, disable (covers guest non-Peanut scenarios)
            if (isActivePeanutWallet && isXChainPeanutWalletReq) return true // peanut wallet x-chain restriction
            if (!selectedTokenAddress || !selectedChainID) return true // must have token/chain
        }
        // fallback for Pinta or other cases if not explicitly handled above
        return false
    }, [
        isProcessing,
        error,
        inputTokenAmount,
        isAddMoneyFlow,
        isWagmiConnected,
        selectedTokenAddress,
        selectedChainID,
        isConnected,
        isActivePeanutWallet,
        isXChainPeanutWalletReq,
        isPintaReq,
    ])

    if (isPintaReq) {
        return (
            <div className="space-y-4">
                {!!user && <FlowHeader />}
                <PintaReqViewWrapper view="INITIAL">
                    <BeerInput disabled={!!amount || !!requestDetails?.tokenAmount || isProcessing} />
                    <div className="space-y-4">
                        {!user ? (
                            <GuestLoginCta hideConnectWallet view="CLAIM" />
                        ) : (
                            <Button
                                shadowSize="4"
                                variant="purple"
                                onClick={handleInitiatePayment}
                                disabled={beerQuantity === 0 || isProcessing}
                                loading={isProcessing}
                                className="w-full"
                            >
                                {getButtonText()}
                            </Button>
                        )}
                        {error && <ErrorAlert description={error} />}
                    </div>
                </PintaReqViewWrapper>
            </div>
        )
    }

    const recipientDisplayName = useMemo(() => {
        return recipient ? recipient.identifier : 'Unknown Recipient'
    }, [recipient])

    const isPeanutWalletUSDC = useMemo(() => {
        return (
            selectedTokenData?.symbol === PEANUT_WALLET_TOKEN_SYMBOL &&
            Number(selectedChainID) === PEANUT_WALLET_CHAIN.id
        )
    }, [selectedTokenData, selectedChainID])

    return (
        <div className="flex h-full min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader onPrev={router.back} title={isAddMoneyFlow ? 'Add Money' : 'Send'} />
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {isWagmiConnected && (!isDirectPay || isAddMoneyFlow) && (
                    <Button
                        icon="switch"
                        iconPosition="right"
                        variant="stroke"
                        size="small"
                        className="ml-auto h-7 w-fit rounded-sm bg-white hover:bg-white hover:text-black active:bg-white"
                        shadowSize="4"
                        iconClassName="min-h-2 h-2 min-w-2 w-2"
                        onClick={(e) => {
                            e.stopPropagation()
                            setDisconnectWagmiModal(true)
                        }}
                    >
                        <AddressLink
                            address={wagmiAddress ?? ''}
                            isLink={false}
                            className="text-xs font-medium text-black no-underline"
                        />
                    </Button>
                )}
                {/* Recipient Info Card */}
                {recipient && !isAddMoneyFlow && (
                    <UserCard
                        type="send"
                        username={recipientDisplayName}
                        recipientType={recipient.recipientType}
                        size="small"
                        message={requestDetails?.reference || chargeDetails?.requestLink?.reference || ''}
                        fileUrl={requestDetails?.attachmentUrl || chargeDetails?.requestLink?.attachmentUrl || ''}
                    />
                )}

                {/* Amount Display Card */}
                <TokenAmountInput
                    tokenValue={inputTokenAmount}
                    setTokenValue={(value: string | undefined) => setInputTokenAmount(value || '')}
                    setUsdValue={(value: string) => setInputUsdValue(value)}
                    setCurrencyAmount={setCurrencyAmount}
                    className="w-full"
                    disabled={!isAddMoneyFlow && (!!requestDetails?.tokenAmount || !!chargeDetails?.tokenAmount)}
                    walletBalance={isActivePeanutWallet ? peanutWalletBalance : undefined}
                    currency={currency}
                />

                {!isActivePeanutWallet && isConnected && !isAddMoneyFlow && (
                    <div className="space-y-2">
                        {!isPeanutWalletUSDC && !selectedTokenAddress && !selectedChainID && (
                            <div className="text-sm font-bold">Select token and chain to pay with</div>
                        )}
                        <TokenSelector viewType="req_pay" />
                        {!isPeanutWalletUSDC && selectedTokenAddress && selectedChainID && (
                            <div className="pt-1 text-center text-xs text-grey-1">
                                <span>Use USDC on Arbitrum for free transactions!</span>
                            </div>
                        )}
                    </div>
                )}

                {isWagmiConnected && isAddMoneyFlow && (
                    <TokenSelector viewType="add" disabled={!isWagmiConnected && isAddMoneyFlow} />
                )}

                <div className="space-y-4">
                    {guestAction()}
                    {isConnected && (
                        <Button
                            variant="purple"
                            loading={isProcessing}
                            shadowSize="4"
                            onClick={handleInitiatePayment}
                            disabled={isButtonDisabled}
                            className="w-full"
                            icon={getButtonIcon()}
                            iconSize={16}
                        >
                            {getButtonText()}
                        </Button>
                    )}
                    {isXChainPeanutWalletReq && !isAddMoneyFlow && (
                        <ErrorAlert
                            description={
                                'Peanut Wallet currently only supports sending USDC on Arbitrum. Please select USDC and Arbitrum, or use an external wallet.'
                            }
                        />
                    )}
                    {error && <ErrorAlert description={error} />}
                </div>
            </div>
            <ActionModal
                visible={disconnectWagmiModal}
                onClose={() => setDisconnectWagmiModal(false)}
                title="Disconnect wallet?"
                description="You'll need to reconnect to continue using crypto features."
                icon="switch"
                ctaClassName="flex-row"
                hideModalCloseButton={true}
                ctas={[
                    {
                        text: 'Disconnect',
                        onClick: () => {
                            disconnectWagmi()
                            setDisconnectWagmiModal(false)
                        },
                        shadowSize: '4',
                    },
                    {
                        text: 'Cancel',
                        onClick: () => {
                            setDisconnectWagmiModal(false)
                        },
                        shadowSize: '4',
                        className: 'bg-grey-4 hover:bg-grey-4 hover:text-black active:bg-grey-4',
                    },
                ]}
            />
        </div>
    )
}
