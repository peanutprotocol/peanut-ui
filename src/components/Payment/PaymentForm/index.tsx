'use client'

import { fetchTokenPrice } from '@/app/actions/tokens'
import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FlowHeader from '@/components/Global/FlowHeader'
import GuestLoginCta from '@/components/Global/GuestLoginCta'
import { Icon } from '@/components/Global/Icons/Icon'
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
import { usePaymentInitiator } from '@/hooks/usePaymentInitiator'
import { useWallet } from '@/hooks/wallet/useWallet'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { walletActions } from '@/redux/slices/wallet-slice'
import { ErrorHandler, formatAmount, printableAddress } from '@/utils'
import { useAppKit } from '@reown/appkit/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'

type PaymentFormProps = ParsedURL & {
    isPintaReq?: boolean
    currency?: {
        code: string
        symbol: string
        price: number
    }
    currencyAmount?: string
    setCurrencyAmount?: (currencyvalue: string | undefined) => void
}

export const PaymentForm = ({
    recipient,
    amount,
    token,
    chain,
    isPintaReq,
    currency,
    currencyAmount,
    setCurrencyAmount,
}: PaymentFormProps) => {
    const dispatch = useAppDispatch()
    const router = useRouter()
    const { user } = useAuth()
    const { requestDetails, chargeDetails, beerQuantity } = usePaymentStore()
    const { isConnected: isPeanutWallet, balance } = useWallet()
    const { isConnected: isWagmiConnected, address: wagmiAddress } = useAccount()
    const [initialSetupDone, setInitialSetupDone] = useState(false)
    const [inputTokenAmount, setInputTokenAmount] = useState<string>(
        chargeDetails?.tokenAmount || requestDetails?.tokenAmount || amount || ''
    )
    const [usdValue, setUsdValue] = useState<string>('')
    const [_isFetchingTokenPrice, setIsFetchingTokenPrice] = useState<boolean>(false)

    const { initiatePayment, isProcessing, error } = usePaymentInitiator()

    const peanutWalletBalance = useMemo(() => {
        const formattedBalance = formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))
        return formattedBalance
    }, [balance])

    const {
        inputDenomination,
        setInputDenomination,
        selectedTokenPrice,
        selectedChainID,
        selectedTokenAddress,
        selectedTokenData,
        setSelectedChainID,
        setSelectedTokenAddress,
        setSelectedTokenDecimals,
    } = useContext(tokenSelectorContext)
    const { open: openReownModal } = useAppKit()
    const searchParams = useSearchParams()
    const requestId = searchParams.get('id')
    const isDepositRequest = searchParams.get('action') === 'deposit'

    const isConnected = useMemo<boolean>(() => {
        return isPeanutWallet || isWagmiConnected
    }, [isPeanutWallet, isWagmiConnected])

    const isActivePeanutWallet = useMemo(() => !!user && isPeanutWallet, [user, isPeanutWallet])

    useEffect(() => {
        if (initialSetupDone) return

        if (amount) {
            setInputTokenAmount(amount)
            setInputDenomination(token?.symbol ? 'TOKEN' : 'USD')
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

    // fetch token price
    useEffect(() => {
        if (isPintaReq) return
        if (!requestDetails?.tokenAddress || !requestDetails?.chainId || !requestDetails?.tokenAmount) return

        const getTokenPriceData = async () => {
            setIsFetchingTokenPrice(true)
            try {
                const priceData = await fetchTokenPrice(requestDetails.tokenAddress, requestDetails.chainId)

                if (priceData) {
                    // calculate USD value
                    const tokenAmount = parseFloat(requestDetails.tokenAmount)
                    const usdValue = formatAmount(tokenAmount * priceData.price)

                    setInputDenomination('USD')
                    setInputTokenAmount(usdValue)
                    setUsdValue(usdValue)
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
                (!!inputTokenAmount && parseFloat(inputTokenAmount) > 0 && inputDenomination === 'TOKEN') ||
                (!!usdValue && parseFloat(usdValue) > 0 && inputDenomination === 'USD')
        }

        const tokenSelected = !!selectedTokenAddress && !!selectedChainID
        const recipientExists = !!recipient
        const walletConnected = isConnected

        return recipientExists && amountIsSet && tokenSelected && walletConnected
    }, [
        recipient,
        inputTokenAmount,
        usdValue,
        inputDenomination,
        selectedTokenAddress,
        selectedChainID,
        isPintaReq,
        beerQuantity,
        isConnected,
        isActivePeanutWallet,
    ])

    const handleInitiatePayment = useCallback(async () => {
        if (isDepositRequest && !isConnected) {
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

        dispatch(paymentActions.setError(null))

        const payload = {
            recipient: recipient,
            tokenAmount: inputTokenAmount,
            isPintaReq: false, // explicitly set to false for non-PINTA requests
            requestId: requestId ?? undefined,
            chargeId: chargeDetails?.uuid ?? undefined,
            currency,
            currencyAmount,
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
        dispatch,
        beerQuantity,
        chargeDetails,
    ])

    const getButtonText = () => {
        if (!isConnected) return 'Connect Wallet'
        if (isProcessing) {
            return 'Paying'
        }
        return 'Pay'
    }

    useEffect(() => {
        if (isPintaReq && inputTokenAmount) {
            dispatch(paymentActions.setBeerQuantity(Number(inputTokenAmount)))
        }
    }, [isPintaReq, inputTokenAmount, dispatch])

    useEffect(() => {
        if (!inputTokenAmount) return
        if (inputDenomination === 'TOKEN') {
            if (selectedTokenPrice) {
                setInputDenomination('USD')
                setUsdValue((parseFloat(inputTokenAmount) * selectedTokenPrice).toString())
            }
        } else if (inputDenomination === 'USD') {
            setUsdValue(inputTokenAmount)
        }
    }, [inputTokenAmount, inputDenomination, selectedTokenPrice])

    // Initialize inputTokenAmount
    useEffect(() => {
        if (amount && !inputTokenAmount && !initialSetupDone) {
            setInputTokenAmount(amount)
        }
    }, [amount, inputTokenAmount, initialSetupDone])

    // Initialize inputDenomination
    useEffect(() => {
        if (amount) setInputDenomination(token?.symbol ? 'TOKEN' : 'USD')
    }, [amount, token])

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
        <div className="space-y-8">
            <NavHeader
                title="Send"
                onPrev={() => {
                    if (!!user?.user.userId) {
                        router.push('/send')
                    } else {
                        router.push('/setup')
                    }
                }}
            />
            <div className="space-y-4">
                {!isPeanutWallet && isWagmiConnected && (
                    <FlowHeader
                        rightElement={
                            <Button variant="dark" className="h-7 text-sm" onClick={() => openReownModal()}>
                                {printableAddress(wagmiAddress!)}
                            </Button>
                        }
                    />
                )}
                {/* Recipient Info Card */}
                {recipient && (
                    <UserCard type="send" username={recipientDisplayName} recipientType={recipient.recipientType} />
                )}

                {/* Amount Display Card */}
                <TokenAmountInput
                    tokenValue={inputTokenAmount}
                    setTokenValue={(value: string | undefined) => setInputTokenAmount(value || '')}
                    setCurrencyAmount={setCurrencyAmount}
                    className="w-full"
                    disabled={!!requestDetails?.tokenAmount || !!chargeDetails?.tokenAmount}
                    walletBalance={isActivePeanutWallet ? peanutWalletBalance : undefined}
                    currency={currency}
                />

                {!isActivePeanutWallet && (
                    <div>
                        <div className="mb-2 text-sm font-medium">Select token and chain to pay with</div>
                        <TokenSelector viewType="req_pay" />
                        {!isPeanutWalletUSDC && (
                            <div className="mt-2 flex items-center space-x-1 text-xs text-grey-1">
                                <span>Use USDC on Arbitrum for free transactions!</span>
                            </div>
                        )}
                    </div>
                )}

                {isXChainPeanutWalletReq && (
                    <ErrorAlert
                        label="Note"
                        description={
                            'Peanut Wallet currently only supports sending USDC on Arbitrum. Please select USDC and Arbitrum, or use an external wallet.'
                        }
                    />
                )}

                <div className="space-y-4">
                    <Button
                        variant="purple"
                        loading={isProcessing}
                        shadowSize="4"
                        onClick={handleInitiatePayment}
                        disabled={isConnected && (!canInitiatePayment || isProcessing || isXChainPeanutWalletReq)}
                        className="w-full"
                    >
                        {!isProcessing && <Icon name="currency" />}
                        {getButtonText()}
                    </Button>

                    {error && <ErrorAlert label="Error" description={error} />}
                </div>
            </div>
        </div>
    )
}
