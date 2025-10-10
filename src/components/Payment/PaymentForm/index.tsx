'use client'

import { fetchTokenPrice } from '@/app/actions/tokens'
import { PEANUT_LOGO_BLACK } from '@/assets'
import { PEANUTMAN_LOGO } from '@/assets/peanut'
import { Button } from '@/components/0_Bruddle'
import ActionModal from '@/components/Global/ActionModal'
import AddressLink from '@/components/Global/AddressLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FileUploadInput from '@/components/Global/FileUploadInput'
import { IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import UserCard from '@/components/User/UserCard'
import { PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useAuth } from '@/context/authContext'
import { useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import { InitiatePaymentPayload, usePaymentInitiator } from '@/hooks/usePaymentInitiator'
import { useWallet } from '@/hooks/wallet/useWallet'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { walletActions } from '@/redux/slices/wallet-slice'
import { areEvmAddressesEqual, ErrorHandler, formatAmount, formatCurrency } from '@/utils'
import { useAppKit, useDisconnect } from '@reown/appkit/react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { useUserInteractions } from '@/hooks/useUserInteractions'
import { useUserByUsername } from '@/hooks/useUserByUsername'
import { PaymentFlow } from '@/app/[...recipient]/client'
import MantecaFulfillment from '../Views/MantecaFulfillment.view'
import { invitesApi } from '@/services/invites'
import { EInviteType } from '@/services/services.types'

export type PaymentFlowProps = {
    isExternalWalletFlow?: boolean
    /** Whether this is a direct USD payment flow (bypasses token conversion) */
    isDirectUsdPayment?: boolean
    currency?: {
        code: string
        symbol: string
        price: number
    }
    currencyAmount?: string
    setCurrencyAmount?: (currencyvalue: string | undefined) => void
    headerTitle?: string
    flow?: PaymentFlow
}

export type PaymentFormProps = ParsedURL & PaymentFlowProps

export const PaymentForm = ({
    recipient,
    amount,
    token,
    chain,
    currency,
    currencyAmount,
    setCurrencyAmount,
    isExternalWalletFlow,
    isDirectUsdPayment,
    headerTitle,
    flow,
}: PaymentFormProps) => {
    const dispatch = useAppDispatch()
    const router = useRouter()
    const { user, fetchUser } = useAuth()
    const { requestDetails, chargeDetails, daimoError, error: paymentStoreError, attachmentOptions } = usePaymentStore()
    const {
        setShowExternalWalletFulfillMethods,
        setExternalWalletFulfillMethod,
        fulfillUsingManteca,
        setFulfillUsingManteca,
    } = useRequestFulfillmentFlow()
    const recipientUsername = !chargeDetails && recipient?.recipientType === 'USERNAME' ? recipient.identifier : null
    const { user: recipientUser } = useUserByUsername(recipientUsername)

    const recipientUserId =
        requestDetails?.recipientAccount?.userId ||
        chargeDetails?.requestLink.recipientAccount.userId ||
        recipientUser?.userId
    const recipientKycStatus =
        chargeDetails?.requestLink.recipientAccount.user?.bridgeKycStatus || recipientUser?.bridgeKycStatus

    const { interactions } = useUserInteractions(recipientUserId ? [recipientUserId] : [])
    const { isConnected: isPeanutWalletConnected, balance } = useWallet()
    const { isConnected: isExternalWalletConnected, status } = useAccount()
    const [initialSetupDone, setInitialSetupDone] = useState(false)
    const [inputTokenAmount, setInputTokenAmount] = useState<string>(
        chargeDetails?.tokenAmount || requestDetails?.tokenAmount || amount || ''
    )
    const [isAcceptingInvite, setIsAcceptingInvite] = useState(false)
    const [inviteError, setInviteError] = useState(false)

    // states
    const [disconnectWagmiModal, setDisconnectWagmiModal] = useState<boolean>(false)
    const [inputUsdValue, setInputUsdValue] = useState<string>('')
    const [usdValue, setUsdValue] = useState<string>('')
    const [requestedTokenPrice, setRequestedTokenPrice] = useState<number>(0)
    const [_isFetchingTokenPrice, setIsFetchingTokenPrice] = useState<boolean>(false)

    const { initiatePayment, isProcessing, error: initiatorError } = usePaymentInitiator()

    const peanutWalletBalance = useMemo(() => {
        return balance !== undefined ? formatCurrency(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)) : ''
    }, [balance])

    const error = useMemo(() => {
        if (paymentStoreError) return ErrorHandler(paymentStoreError)
        if (initiatorError) return ErrorHandler(initiatorError)
        if (inviteError) return 'Something went wrong. Please try again or contact support.'
        return null
    }, [paymentStoreError, initiatorError, inviteError])

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

    const isUsingExternalWallet = useMemo(() => {
        return isExternalWalletFlow || !isPeanutWalletConnected
    }, [isPeanutWalletConnected, isExternalWalletFlow])

    const isConnected = useMemo<boolean>(() => {
        return isPeanutWalletConnected || isExternalWalletConnected
    }, [isPeanutWalletConnected, isExternalWalletConnected, status])

    const isActivePeanutWallet = useMemo(() => !!user && isPeanutWalletConnected, [user, isPeanutWalletConnected])

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
        dispatch(paymentActions.setDaimoError(null))
    }, [dispatch, recipient])

    useEffect(() => {
        dispatch(paymentActions.setError(null))

        const currentInputAmountStr = String(inputTokenAmount)
        const parsedInputAmount = parseFloat(currentInputAmountStr.replace(/,/g, ''))

        if (!currentInputAmountStr || isNaN(parsedInputAmount) || parsedInputAmount <= 0) {
            // if input is invalid or zero, no balance check is needed yet, or clear error if it was for insufficient balance
            return
        }

        try {
            if (isExternalWalletFlow) {
                // ADD MONEY FLOW: Strictly check external wallet if connected
                if (isExternalWalletConnected && selectedTokenData && selectedTokenBalance !== undefined) {
                    if (selectedTokenData.decimals === undefined) {
                        console.error('Selected token has no decimals information for Add Money.')
                        dispatch(paymentActions.setError('Cannot verify balance: token data incomplete.'))
                        return
                    }
                    const numericSelectedTokenBalance = parseFloat(String(selectedTokenBalance).replace(/,/g, ''))
                    if (numericSelectedTokenBalance < parsedInputAmount) {
                        dispatch(paymentActions.setError('Insufficient balance in connected wallet'))
                    } else {
                        dispatch(paymentActions.setError(null))
                    }
                } else {
                    // not connected or data missing for add money flow, clear error
                    dispatch(paymentActions.setError(null))
                }
            } else {
                // regular send/pay
                if (isActivePeanutWallet && areEvmAddressesEqual(selectedTokenAddress, PEANUT_WALLET_TOKEN)) {
                    // peanut wallet payment
                    const walletNumeric = parseFloat(String(peanutWalletBalance).replace(/,/g, ''))
                    if (walletNumeric < parsedInputAmount) {
                        dispatch(paymentActions.setError('Insufficient balance'))
                    } else {
                        dispatch(paymentActions.setError(null))
                    }
                } else if (
                    isExternalWalletConnected &&
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
                    const numericSelectedTokenBalance = parseFloat(String(selectedTokenBalance).replace(/,/g, ''))
                    if (numericSelectedTokenBalance < parsedInputAmount) {
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
        isExternalWalletConnected,
        isExternalWalletFlow,
    ])

    // fetch token price
    useEffect(() => {
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
    }, [requestDetails])

    const canInitiatePayment = useMemo<boolean>(() => {
        let amountIsSet = false
        if (isActivePeanutWallet) {
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
        isConnected,
        isActivePeanutWallet,
    ])

    const handleAcceptInvite = async () => {
        try {
            setIsAcceptingInvite(true)
            const inviteCode = `${recipient?.identifier}INVITESYOU`
            await invitesApi.acceptInvite(inviteCode, EInviteType.PAYMENT_LINK)
            // fetch user so that we have the latest state and user can access the app.
            // We dont need to wait for this, can happen in background.
            await fetchUser()
            setIsAcceptingInvite(false)
        } catch (error) {
            console.error('Failed to accept invite', error)
            setInviteError(true)
            setIsAcceptingInvite(false)
            return
        }
    }

    const handleInitiatePayment = useCallback(async () => {
        // clear invite error
        if (inviteError) {
            setInviteError(false)
        }
        if (isActivePeanutWallet && isInsufficientBalanceError && !isExternalWalletFlow) {
            // If the user doesn't have app access, accept the invite before claiming the link
            if (recipient.recipientType === 'USERNAME' && !user?.user.hasAppAccess) {
                await handleAcceptInvite()
            }
            router.push('/add-money')
            return
        }

        if (!isExternalWalletConnected && isExternalWalletFlow) {
            openReownModal()
            return
        }

        if (!isConnected) {
            dispatch(walletActions.setSignInModalVisible(true))
            return
        }

        if (!canInitiatePayment) return

        // regular payment flow
        if (!inputTokenAmount || parseFloat(inputTokenAmount) <= 0) {
            console.error('Invalid amount entered')
            dispatch(paymentActions.setError('Please enter a valid amount'))
            return
        }

        if (inputUsdValue && parseFloat(inputUsdValue) > 0) {
            dispatch(paymentActions.setUsdAmount(inputUsdValue))
        }

        if (
            !isActivePeanutWallet &&
            isExternalWalletConnected &&
            selectedTokenData &&
            selectedChainID &&
            !!chargeDetails
        ) {
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
            requestId: requestId ?? undefined,
            chargeId: chargeDetails?.uuid,
            currency,
            currencyAmount,
            isExternalWalletFlow: !!isExternalWalletFlow || fulfillUsingManteca,
            transactionType: isExternalWalletFlow
                ? 'DEPOSIT'
                : isDirectUsdPayment || !requestId
                  ? 'DIRECT_SEND'
                  : 'REQUEST',
            attachmentOptions: attachmentOptions,
        }

        console.log('Initiating payment with payload:', payload)

        const result = await initiatePayment(payload)

        if (result.status === 'Success') {
            dispatch(paymentActions.setView('STATUS'))
        } else if (result.status === 'Charge Created') {
            if (!fulfillUsingManteca) {
                dispatch(paymentActions.setView('CONFIRM'))
            }
        } else if (result.status === 'Error') {
            console.error('Payment initiation failed:', result.error)
        } else {
            console.warn('Unexpected status from usePaymentInitiator:', result.status)
        }
    }, [
        fulfillUsingManteca,
        canInitiatePayment,
        isDepositRequest,
        isConnected,
        openReownModal,
        recipient,
        inputTokenAmount,
        requestId,
        initiatePayment,
        chargeDetails,
        isExternalWalletFlow,
        requestDetails,
        selectedTokenAddress,
        selectedChainID,
        inputUsdValue,
        requestedTokenPrice,
    ])

    const getButtonText = () => {
        if (!isExternalWalletConnected && isExternalWalletFlow) {
            return 'Connect Wallet'
        }

        if (isExternalWalletFlow) {
            return 'Review'
        }

        if (isProcessing) {
            return 'Send'
        }

        if (isActivePeanutWallet && isInsufficientBalanceError && !isExternalWalletFlow) {
            return (
                <div className="flex items-center gap-1">
                    <div>Add funds to </div>
                    <div className="flex items-center gap-1">
                        <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                        <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                    </div>
                </div>
            )
        }

        if (isActivePeanutWallet) {
            return (
                <div className="flex items-center gap-1">
                    <div>Send with </div>
                    <div className="flex items-center gap-1">
                        <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                        <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                    </div>
                </div>
            )
        }

        return 'Review'
    }

    const getButtonIcon = (): IconName | undefined => {
        if (!isExternalWalletConnected && isExternalWalletFlow) return 'wallet-outline'

        if (isActivePeanutWallet && isInsufficientBalanceError && !isExternalWalletFlow) return 'arrow-down'

        if (!isProcessing && isActivePeanutWallet && !isExternalWalletFlow) return 'arrow-up-right'

        return undefined
    }

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

    useEffect(() => {
        const stepFromURL = searchParams.get('step')
        if (user && stepFromURL === 'regional-req-fulfill') {
            setFulfillUsingManteca(true)
        } else {
            setFulfillUsingManteca(false)
        }
    }, [user, searchParams])

    useEffect(() => {
        if (fulfillUsingManteca && !chargeDetails) {
            handleInitiatePayment()
        }
    }, [fulfillUsingManteca, chargeDetails, handleInitiatePayment])

    const isInsufficientBalanceError = useMemo(() => {
        return error?.includes("You don't have enough balance.")
    }, [error])

    const isButtonDisabled = useMemo(() => {
        if (isProcessing) return true
        if (isActivePeanutWallet && isInsufficientBalanceError && !isExternalWalletFlow) return false
        if (!!error) return true

        // ensure inputTokenAmount is a valid positive number before allowing payment
        const numericAmount = parseFloat(inputTokenAmount)
        if (isNaN(numericAmount) || numericAmount <= 0) {
            if (!isExternalWalletFlow) return true
        }

        if (isExternalWalletFlow) {
            if (!isExternalWalletConnected) return false // "Connect Wallet" button should be active
            return (
                !inputTokenAmount ||
                isNaN(parseFloat(inputTokenAmount)) ||
                parseFloat(inputTokenAmount) <= 0 ||
                !selectedTokenAddress ||
                !selectedChainID ||
                isProcessing
            )
        }

        if (flow === 'request_pay') return false

        // fallback for other cases if not explicitly handled above
        return false
    }, [
        isProcessing,
        error,
        inputTokenAmount,
        isExternalWalletFlow,
        isExternalWalletConnected,
        selectedTokenAddress,
        selectedChainID,
        isConnected,
        isActivePeanutWallet,
    ])

    const recipientDisplayName = useMemo(() => {
        return recipient ? recipient.identifier : 'Unknown Recipient'
    }, [recipient])

    const handleGoBack = () => {
        if (isExternalWalletFlow) {
            setShowExternalWalletFulfillMethods(true)
            setExternalWalletFulfillMethod(null)
            return
        } else if (window.history.length > 1) {
            router.back()
        } else {
            router.push('/')
        }
    }

    if (fulfillUsingManteca && chargeDetails) {
        return <MantecaFulfillment />
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader onPrev={handleGoBack} title={headerTitle ?? (isExternalWalletFlow ? 'Add Money' : 'Send')} />
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                {isExternalWalletConnected && isUsingExternalWallet && (
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
                {recipient && !isExternalWalletFlow && (
                    <UserCard
                        type="send"
                        username={recipientDisplayName}
                        recipientType={recipient.recipientType}
                        size="small"
                        message={requestDetails?.reference || chargeDetails?.requestLink?.reference || ''}
                        fileUrl={requestDetails?.attachmentUrl || chargeDetails?.requestLink?.attachmentUrl || ''}
                        isVerified={recipientKycStatus === 'approved'}
                        haveSentMoneyToUser={recipientUserId ? interactions[recipientUserId] || false : false}
                    />
                )}

                {/* Amount Display Card */}
                <TokenAmountInput
                    tokenValue={inputTokenAmount}
                    setTokenValue={(value: string | undefined) => setInputTokenAmount(value || '')}
                    setUsdValue={(value: string) => {
                        setInputUsdValue(value)
                        dispatch(paymentActions.setUsdAmount(value))
                    }}
                    setCurrencyAmount={setCurrencyAmount}
                    className="w-full"
                    disabled={!isExternalWalletFlow && (!!requestDetails?.tokenAmount || !!chargeDetails?.tokenAmount)}
                    walletBalance={isActivePeanutWallet ? peanutWalletBalance : undefined}
                    currency={currency}
                    hideCurrencyToggle={!currency}
                    hideBalance={isExternalWalletFlow}
                />

                {/*
                    Url request flow (peanut.me/<address>)
                    If we are paying from peanut wallet we only need to
                    select a token if it's not included in the url
                    From other wallets we always need to select a token
                */}
                {/* we dont need this as daimo will handle token selection */}
                {/* {!(chain && isPeanutWalletConnected) && isConnected && !isAddMoneyFlow && (
                    <div className="space-y-2">
                        {!isPeanutWalletUSDC && !selectedTokenAddress && !selectedChainID && (
                            <div className="text-sm font-bold">Select token and chain to receive</div>
                        )}
                        <TokenSelector viewType="req_pay" />
                        {!isPeanutWalletUSDC && selectedTokenAddress && selectedChainID && (
                            <div className="pt-1 text-center text-xs text-grey-1">
                                <span>Use USDC on Arbitrum for free transactions!</span>
                            </div>
                        )}
                    </div>
                )} */}

                {/* {isExternalWalletConnected && isAddMoneyFlow && (
                    <TokenSelector viewType="add" disabled={!isExternalWalletConnected && isAddMoneyFlow} />
                )} */}

                {isDirectUsdPayment && (
                    <FileUploadInput
                        placeholder="Comment"
                        attachmentOptions={attachmentOptions}
                        setAttachmentOptions={(options) => dispatch(paymentActions.setAttachmentOptions(options))}
                        className="h-11"
                    />
                )}

                <div className="space-y-4">
                    {isPeanutWalletConnected && (!error || isInsufficientBalanceError) && (
                        <Button
                            variant="purple"
                            loading={isAcceptingInvite || isProcessing}
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
                    {isPeanutWalletConnected && error && !isInsufficientBalanceError && (
                        <Button
                            variant="purple"
                            loading={isProcessing}
                            shadowSize="4"
                            onClick={() => {
                                handleInitiatePayment()
                            }}
                            disabled={isProcessing}
                            className="w-full"
                            icon="retry"
                            iconSize={16}
                        >
                            Retry
                        </Button>
                    )}
                    {daimoError && <ErrorAlert description={daimoError} />}

                    {!daimoError && error && (
                        <ErrorAlert
                            description={
                                error.includes("You don't have enough balance.")
                                    ? 'Not enough balance to fulfill this request with Peanut'
                                    : error
                            }
                        />
                    )}
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
