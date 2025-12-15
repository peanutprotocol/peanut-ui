'use client'

import { PEANUT_LOGO_BLACK } from '@/assets'
import { PEANUTMAN_LOGO } from '@/assets/peanut'
import { Button } from '@/components/0_Bruddle'
import ActionModal from '@/components/Global/ActionModal'
import AddressLink from '@/components/Global/AddressLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FileUploadInput from '@/components/Global/FileUploadInput'
import { type IconName } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import PaymentAmountInput from '@/components/Payment/PaymentAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import UserCard from '@/components/User/UserCard'
import { PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_DECIMALS, PEANUT_WALLET_CHAIN } from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useAuth } from '@/context/authContext'
import { useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import { type InitiatePaymentPayload, usePaymentInitiator } from '@/hooks/usePaymentInitiator'
import { useWallet } from '@/hooks/wallet/useWallet'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { useTokenPrice } from '@/hooks/useTokenPrice'
import { useSquidChainsAndTokens } from '@/hooks/useSquidChainsAndTokens'
import { type ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { walletActions } from '@/redux/slices/wallet-slice'
import { areEvmAddressesEqual, ErrorHandler, formatAmount, formatCurrency, getContributorsFromCharge } from '@/utils'
import { useAppKit, useDisconnect } from '@reown/appkit/react'
import { initializeAppKit } from '@/config/wagmi.config'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { useUserInteractions } from '@/hooks/useUserInteractions'
import { useUserByUsername } from '@/hooks/useUserByUsername'
import { type PaymentFlow } from '@/app/[...recipient]/client'
import { invitesApi } from '@/services/invites'
import { EInviteType } from '@/services/services.types'
import ContributorCard from '@/components/Global/Contributors/ContributorCard'
import { getCardPosition } from '@/components/Global/Card'
import * as Sentry from '@sentry/nextjs'
import { useHaptic } from 'use-haptic'
import TokenAmountInput from '@/components/Global/TokenAmountInput'

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
    showRequestPotInitialView?: boolean
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
    showRequestPotInitialView,
}: PaymentFormProps) => {
    const dispatch = useAppDispatch()
    const router = useRouter()
    const { user, fetchUser } = useAuth()
    const {
        requestDetails,
        chargeDetails,
        daimoError,
        error: paymentStoreError,
        attachmentOptions,
        currentView,
        parsedPaymentData,
    } = usePaymentStore()
    const { triggerPayWithPeanut, setTriggerPayWithPeanut } = useRequestFulfillmentFlow()
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

    // Fetch Squid chains and tokens for token price lookup
    const { data: supportedSquidChainsAndTokens = {} } = useSquidChainsAndTokens()

    // Fetch token price for request details (xchain requests)
    const { data: requestedTokenPriceData } = useTokenPrice({
        tokenAddress: requestDetails?.tokenAddress,
        chainId: requestDetails?.chainId,
        supportedSquidChainsAndTokens,
        isPeanutWallet: false, // Request details are always external tokens
    })
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

    const { initiatePayment, isProcessing, error: initiatorError } = usePaymentInitiator()
    const { hasPendingTransactions } = usePendingTransactions()

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
        selectedChainID,
        selectedTokenAddress,
        selectedTokenData,
        setSelectedChainID,
        setSelectedTokenAddress,
        selectedTokenBalance,
    } = useContext(tokenSelectorContext)
    const { open: openReownModal } = useAppKit()
    const { disconnect: disconnectWagmi } = useDisconnect()
    const { address: wagmiAddress } = useAccount()
    const searchParams = useSearchParams()
    const requestId = searchParams.get('id')
    const isDepositRequest = searchParams.get('action') === 'deposit'
    const { triggerHaptic } = useHaptic()

    const isUsingExternalWallet = useMemo(() => {
        return isExternalWalletFlow || !isPeanutWalletConnected
    }, [isPeanutWalletConnected, isExternalWalletFlow])

    const isConnected = useMemo<boolean>(() => {
        return isPeanutWalletConnected || isExternalWalletConnected
    }, [isPeanutWalletConnected, isExternalWalletConnected, status])

    const isActivePeanutWallet = useMemo(() => !!user && isPeanutWalletConnected, [user, isPeanutWalletConnected])

    const isRequestPotLink = !!chargeDetails?.requestLink

    useEffect(() => {
        // skip this step for request pot payments
        // Amount is set by the user so we dont need to manually update it
        // chain and token are also USDC arb always, for cross-chain we use Daimo
        if (initialSetupDone || showRequestPotInitialView || isRequestPotLink) return

        // prioritize charge amount over URL amount
        if (chargeDetails?.tokenAmount) {
            setInputTokenAmount(chargeDetails.tokenAmount)
        } else if (amount) {
            setInputTokenAmount(amount)
        }

        // for ADDRESS/ENS recipients, initialize token/chain from URL or defaults
        const isExternalRecipient = recipient?.recipientType === 'ADDRESS' || recipient?.recipientType === 'ENS'

        if (chain) {
            setSelectedChainID((chain.chainId || requestDetails?.chainId) ?? '')
            if (!token && !requestDetails?.tokenAddress) {
                const defaultToken = chain.tokens.find((t) => t.symbol.toLowerCase() === 'usdc')
                if (defaultToken) {
                    setSelectedTokenAddress(defaultToken.address)
                    // Note: decimals automatically derived by useTokenPrice hook
                }
            }
        } else if (isExternalRecipient && !selectedChainID) {
            // default to arbitrum for external recipients if no chain specified
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
        }

        if (token) {
            setSelectedTokenAddress((token.address || requestDetails?.tokenAddress) ?? '')
            // Note: decimals automatically derived by useTokenPrice hook
        } else if (isExternalRecipient && !selectedTokenAddress && selectedChainID) {
            // default to USDC for external recipients if no token specified
            const chainData = supportedSquidChainsAndTokens[selectedChainID]
            const defaultToken = chainData?.tokens.find((t) => t.symbol.toLowerCase() === 'usdc')
            if (defaultToken) {
                setSelectedTokenAddress(defaultToken.address)
            }
        }

        setInitialSetupDone(true)
    }, [
        chain,
        token,
        amount,
        initialSetupDone,
        requestDetails,
        showRequestPotInitialView,
        isRequestPotLink,
        recipient?.recipientType,
        selectedChainID,
        selectedTokenAddress,
        supportedSquidChainsAndTokens,
    ])

    // reset error when component mounts or recipient changes
    useEffect(() => {
        dispatch(paymentActions.setError(null))
        dispatch(paymentActions.setDaimoError(null))
    }, [dispatch, recipient])

    useEffect(() => {
        // Skip balance check if on CONFIRM or STATUS view, or if transaction is being processed, or if we have pending txs
        if (currentView === 'CONFIRM' || currentView === 'STATUS' || isProcessing || hasPendingTransactions) {
            return
        }

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
                const isExternalRecipient = recipient?.recipientType === 'ADDRESS' || recipient?.recipientType === 'ENS'

                if (
                    !showRequestPotInitialView && // don't apply balance check on request pot payment initial view
                    isActivePeanutWallet &&
                    !isExternalRecipient
                ) {
                    // peanut wallet payment for USERNAME recipients
                    const walletNumeric = parseFloat(String(peanutWalletBalance).replace(/,/g, ''))
                    if (walletNumeric < parsedInputAmount) {
                        dispatch(paymentActions.setError('Insufficient balance'))
                    } else {
                        dispatch(paymentActions.setError(null))
                    }
                } else if (
                    !showRequestPotInitialView &&
                    isActivePeanutWallet &&
                    isExternalRecipient &&
                    areEvmAddressesEqual(selectedTokenAddress, PEANUT_WALLET_TOKEN)
                ) {
                    // for external recipients (ADDRESS/ENS) paying with peanut wallet, check peanut wallet balance directly
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
                } else if (isExternalRecipient && isActivePeanutWallet) {
                    // for external recipients with peanut wallet using non-USDC tokens, balance will be checked via cross-chain route
                    dispatch(paymentActions.setError(null))
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
        showRequestPotInitialView,
        currentView,
        isProcessing,
        hasPendingTransactions,
        recipient?.recipientType,
    ])

    // Calculate USD value when requested token price is available
    useEffect(() => {
        // skip this step for request pot payments
        // Amount is set by the user so we dont need to manually update it
        // No usd conversion needed because amount will always be USDC
        if (
            showRequestPotInitialView ||
            !requestedTokenPriceData?.price ||
            !requestDetails?.tokenAmount ||
            isRequestPotLink
        )
            return

        const tokenAmount = parseFloat(requestDetails.tokenAmount)
        if (isNaN(tokenAmount) || tokenAmount <= 0) return

        if (isNaN(requestedTokenPriceData.price) || requestedTokenPriceData.price === 0) return

        const usdValue = formatAmount(tokenAmount * requestedTokenPriceData.price)

        setInputTokenAmount(usdValue)
        setUsdValue(usdValue)
    }, [requestedTokenPriceData?.price, requestDetails?.tokenAmount, showRequestPotInitialView, isRequestPotLink])

    const canInitiatePayment = useMemo<boolean>(() => {
        let amountIsSet = false
        if (isActivePeanutWallet) {
            amountIsSet = !!inputTokenAmount && parseFloat(inputTokenAmount) > 0
        } else {
            amountIsSet =
                (!!inputTokenAmount && parseFloat(inputTokenAmount) > 0) || (!!usdValue && parseFloat(usdValue) > 0)
        }

        const isExternalRecipient = recipient?.recipientType === 'ADDRESS' || recipient?.recipientType === 'ENS'
        // for external recipients, token selection is required
        // for USERNAME recipients, token is always PEANUT_WALLET_TOKEN
        const tokenSelected = isExternalRecipient
            ? !!selectedTokenAddress && !!selectedChainID
            : !!selectedTokenAddress && !!selectedChainID
        const recipientExists = !!recipient
        const walletConnected = isConnected

        // If its requestPotPayment, we only need to check if the recipient exists, amount is set, and token is selected
        if (showRequestPotInitialView) {
            return recipientExists && amountIsSet && tokenSelected && showRequestPotInitialView
        }

        return recipientExists && amountIsSet && tokenSelected && walletConnected
    }, [
        showRequestPotInitialView,
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
            const result = await invitesApi.acceptInvite(inviteCode, EInviteType.PAYMENT_LINK)

            if (!result.success) {
                console.error('Failed to accept invite')
                setInviteError(true)
                setIsAcceptingInvite(false)
                return false
            }

            // fetch user so that we have the latest state and user can access the app.
            // We dont need to wait for this, can happen in background.
            await fetchUser()
            setIsAcceptingInvite(false)
            return true
        } catch (error) {
            console.error('Failed to accept invite', error)
            setInviteError(true)
            setIsAcceptingInvite(false)
            return false
        }
    }

    const handleInitiatePayment = useCallback(async () => {
        // clear invite error
        if (inviteError) {
            setInviteError(false)
        }
        // redirect to add money if insufficient balance
        if (!showRequestPotInitialView && isActivePeanutWallet && isInsufficientBalanceError && !isExternalWalletFlow) {
            // if the user doesn't have app access, accept the invite before redirecting
            // only applies to USERNAME recipients (invite links)
            if (recipient.recipientType === 'USERNAME' && !user?.user.hasAppAccess) {
                const isAccepted = await handleAcceptInvite()
                if (!isAccepted) return
            }
            router.push('/add-money')
            return
        }

        // skip this step for request pots initial view
        if (!showRequestPotInitialView && !isExternalWalletConnected && isExternalWalletFlow) {
            try {
                await initializeAppKit()
                openReownModal()
            } catch (error) {
                console.error('Failed to initialize AppKit:', error)
                Sentry.captureException(error, {
                    tags: { context: 'payment_form_external_wallet' },
                    extra: { flow: 'external_wallet_payment' },
                })
            }
        }

        // skip this step for request pots initial view
        if (!showRequestPotInitialView && !isConnected) {
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
            requestedTokenPriceData?.price &&
            (requestedChain !== selectedChainID || !areEvmAddressesEqual(requestedToken, selectedTokenAddress))
        ) {
            // Validate price before division
            if (isNaN(requestedTokenPriceData.price) || requestedTokenPriceData.price === 0) {
                console.error('Invalid token price for conversion')
                dispatch(paymentActions.setError('Cannot calculate token amount: invalid price data'))
                return
            }

            const usdAmount = parseFloat(inputUsdValue)
            if (isNaN(usdAmount)) {
                console.error('Invalid USD amount')
                dispatch(paymentActions.setError('Invalid amount entered'))
                return
            }

            tokenAmount = (usdAmount / requestedTokenPriceData.price).toString()
        }

        const payload: InitiatePaymentPayload = {
            recipient: recipient,
            tokenAmount,
            requestId: requestId ?? undefined,
            chargeId: chargeDetails?.uuid,
            currency,
            currencyAmount,
            isExternalWalletFlow: !!isExternalWalletFlow,
            transactionType: isExternalWalletFlow
                ? 'DEPOSIT'
                : isDirectUsdPayment || !requestId
                  ? 'DIRECT_SEND'
                  : 'REQUEST',
            attachmentOptions: attachmentOptions,
            returnAfterChargeCreation: !!showRequestPotInitialView, // For request pot initial view, return after charge creation without initiating payment
        }

        console.log('Initiating payment with payload:', payload)

        const result = await initiatePayment(payload)

        if (result.status === 'Success') {
            triggerHaptic()
            dispatch(paymentActions.setView('STATUS'))
        } else if (result.status === 'Charge Created') {
            if (!showRequestPotInitialView) {
                dispatch(paymentActions.setView('CONFIRM'))
            }
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
        requestId,
        initiatePayment,
        chargeDetails,
        isExternalWalletFlow,
        requestDetails,
        selectedTokenAddress,
        selectedChainID,
        inputUsdValue,
        requestedTokenPriceData?.price,
        inviteError,
        handleAcceptInvite,
        showRequestPotInitialView,
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

        if (showRequestPotInitialView) {
            return 'Choose payment method'
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
        if (!showRequestPotInitialView && !isExternalWalletConnected && isExternalWalletFlow) return 'wallet-outline'

        if (!showRequestPotInitialView && isActivePeanutWallet && isInsufficientBalanceError && !isExternalWalletFlow)
            return 'arrow-down'

        if (!showRequestPotInitialView && !isProcessing && isActivePeanutWallet && !isExternalWalletFlow)
            return 'arrow-up-right'

        return undefined
    }

    useEffect(() => {
        if (!inputTokenAmount) return
        if (selectedTokenData?.price) {
            const amount = parseFloat(inputTokenAmount)
            if (isNaN(amount) || amount < 0) return

            if (isNaN(selectedTokenData.price) || selectedTokenData.price === 0) return

            setUsdValue((amount * selectedTokenData.price).toString())
        }
    }, [inputTokenAmount, selectedTokenData?.price])

    // Initialize inputTokenAmount
    useEffect(() => {
        // skip this step for request pot payments and request pot links (charge view)
        // Amount is set by the user so we dont need to manually update it
        if (amount && !inputTokenAmount && !initialSetupDone && !showRequestPotInitialView && !isRequestPotLink) {
            setInputTokenAmount(amount)
        }
    }, [amount, inputTokenAmount, initialSetupDone, showRequestPotInitialView, isRequestPotLink])

    // Trigger payment with peanut from action list
    useEffect(() => {
        if (triggerPayWithPeanut) {
            handleInitiatePayment()
            setTriggerPayWithPeanut(false)
        }
    }, [triggerPayWithPeanut, handleInitiatePayment, setTriggerPayWithPeanut])

    const isInsufficientBalanceError = useMemo(() => {
        return error?.includes("You don't have enough balance.") || error?.includes('Insufficient balance')
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
        if (window.history.length > 1) {
            router.back()
        } else {
            router.push('/')
        }
    }

    const contributors = getContributorsFromCharge(requestDetails?.charges || [])

    const totalAmountCollected = requestDetails?.totalCollectedAmount ?? 0

    // determine when to use TokenAmountInput vs PaymentAmountInput
    // use TokenAmountInput for:
    // 1. request pot payments to usernames (typing bug fix)
    // 2. payments to ADDRESS/ENS recipients (typing bug fix)
    // note: kush to kill the annoying token amount input component
    const shouldUseTokenAmountInput = useMemo(() => {
        const isRequestPotToUsername =
            showRequestPotInitialView && recipient?.recipientType === 'USERNAME' && !!requestDetails
        const isExternalRecipient = recipient?.recipientType === 'ADDRESS' || recipient?.recipientType === 'ENS'
        return isRequestPotToUsername || isExternalRecipient
    }, [showRequestPotInitialView, recipient?.recipientType, requestDetails])

    const defaultSliderValue = useMemo(() => {
        const charges = requestDetails?.charges
        const totalAmount = requestDetails?.tokenAmount ? parseFloat(requestDetails.tokenAmount) : 0
        const totalCollected = totalAmountCollected

        if (totalAmount <= 0) return { percentage: 0, suggestedAmount: 0 }

        // No charges yet - suggest 100% (full pot)
        if (!charges || charges.length === 0) {
            return { percentage: 100, suggestedAmount: totalAmount }
        }

        // Calculate average contribution from existing charges
        const contributionAmounts = charges
            .map((charge) => parseFloat(charge.tokenAmount))
            .filter((amount) => !isNaN(amount) && amount > 0)

        if (contributionAmounts.length === 0) return { percentage: 0, suggestedAmount: 0 }

        // Check if this is an equal-split pattern (1 payment at ~33% or 2 payments at ~66%)
        const collectedPercentage = (totalCollected / totalAmount) * 100
        const isOneThirdCollected = Math.abs(collectedPercentage - 100 / 3) < 2 // ~33.33%
        const isTwoThirdsCollected = Math.abs(collectedPercentage - 200 / 3) < 2 // ~66.67%

        if (isOneThirdCollected || isTwoThirdsCollected) {
            // Suggest exact 33.33% to maintain equal split pattern
            const exactThird = 100 / 3
            return { percentage: exactThird, suggestedAmount: totalAmount * (exactThird / 100) }
        }

        // Otherwise suggest the median contribution (more robust against outliers than average)
        const sortedAmounts = [...contributionAmounts].sort((a, b) => a - b)
        const midIndex = Math.floor(sortedAmounts.length / 2)
        const suggestedAmount =
            sortedAmounts.length % 2 === 0
                ? (sortedAmounts[midIndex - 1] + sortedAmounts[midIndex]) / 2 // even: average of middle two
                : sortedAmounts[midIndex] // odd: middle value

        // Convert amount to percentage of total pot
        const percentage = (suggestedAmount / totalAmount) * 100
        // Cap at 100% max
        return { percentage: Math.min(percentage, 100), suggestedAmount }
    }, [requestDetails?.charges, requestDetails?.tokenAmount, totalAmountCollected])
    console.log('inputTokenAmount', inputTokenAmount)

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <NavHeader onPrev={handleGoBack} title={headerTitle ?? (isExternalWalletFlow ? 'Add Money' : 'Pay')} />
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
                        type={showRequestPotInitialView ? 'request_pay' : 'send'}
                        username={recipientDisplayName}
                        recipientType={recipient.recipientType}
                        size="small"
                        message={requestDetails?.reference || chargeDetails?.requestLink?.reference || ''}
                        fileUrl={requestDetails?.attachmentUrl || chargeDetails?.requestLink?.attachmentUrl || ''}
                        isVerified={recipientKycStatus === 'approved'}
                        haveSentMoneyToUser={recipientUserId ? interactions[recipientUserId] || false : false}
                        amount={showRequestPotInitialView && amount ? Number(amount) : undefined}
                        amountCollected={showRequestPotInitialView ? totalAmountCollected : undefined}
                        isRequestPot={showRequestPotInitialView}
                    />
                )}

                {/* mark the date - 16/11/2025, the author has written worse piece of code that the humanity will ever witness, but it works, so in the promiseland of post devconnect, i the kush, the author will kill this code to fix it once and for all */}
                {/* Amount Display Card */}
                {/* use TokenAmountInput for direct usd payments, request pot payments, and external address payments to avoid typing issues */}
                {isDirectUsdPayment || shouldUseTokenAmountInput ? (
                    <TokenAmountInput
                        tokenValue={inputTokenAmount.replace(/,/g, '')}
                        setTokenValue={(value: string | undefined) => setInputTokenAmount(value || '')}
                        setUsdValue={(value: string) => {
                            setInputUsdValue(value)
                            dispatch(paymentActions.setUsdAmount(value))
                        }}
                        setCurrencyAmount={setCurrencyAmount}
                        className="w-full"
                        disabled={
                            !showRequestPotInitialView &&
                            !isExternalWalletFlow &&
                            (!!requestDetails?.tokenAmount || !!chargeDetails?.tokenAmount)
                        }
                        walletBalance={isActivePeanutWallet ? peanutWalletBalance : undefined}
                        currency={currency}
                        hideCurrencyToggle={!currency}
                        hideBalance={isExternalWalletFlow}
                        showSlider={showRequestPotInitialView && amount ? Number(amount) > 0 : false}
                        maxAmount={showRequestPotInitialView && amount ? Number(amount) : undefined}
                        amountCollected={showRequestPotInitialView ? totalAmountCollected : 0}
                        defaultSliderValue={showRequestPotInitialView ? defaultSliderValue.percentage : undefined}
                        defaultSliderSuggestedAmount={
                            showRequestPotInitialView ? defaultSliderValue.suggestedAmount : undefined
                        }
                    />
                ) : (
                    <PaymentAmountInput
                        tokenValue={inputTokenAmount}
                        setTokenValue={(value: string | undefined) => setInputTokenAmount(value || '')}
                        setUsdValue={(value: string) => {
                            setInputUsdValue(value)
                            dispatch(paymentActions.setUsdAmount(value))
                        }}
                        setCurrencyAmount={setCurrencyAmount}
                        className="w-full"
                        disabled={
                            !showRequestPotInitialView &&
                            !isExternalWalletFlow &&
                            (!!requestDetails?.tokenAmount || !!chargeDetails?.tokenAmount)
                        }
                        walletBalance={isActivePeanutWallet ? peanutWalletBalance : undefined}
                        currency={currency}
                        hideCurrencyToggle={!currency}
                        hideBalance={isExternalWalletFlow}
                        showSlider={showRequestPotInitialView && amount ? Number(amount) > 0 : false}
                        maxAmount={showRequestPotInitialView && amount ? Number(amount) : undefined}
                        amountCollected={showRequestPotInitialView ? totalAmountCollected : 0}
                        defaultSliderValue={showRequestPotInitialView ? defaultSliderValue.percentage : undefined}
                        defaultSliderSuggestedAmount={
                            showRequestPotInitialView ? defaultSliderValue.suggestedAmount : undefined
                        }
                    />
                )}

                {/* Token selector for external ADDRESS/ENS recipients */}
                {/* only show if chain is not specified in URL */}
                {!isExternalWalletFlow &&
                    !showRequestPotInitialView &&
                    !chain?.chainId &&
                    (recipient?.recipientType === 'ADDRESS' || recipient?.recipientType === 'ENS') &&
                    isConnected && (
                        <div className="space-y-2">
                            <TokenSelector viewType="req_pay" />
                            {selectedTokenAddress &&
                                selectedChainID &&
                                !(
                                    areEvmAddressesEqual(selectedTokenAddress, PEANUT_WALLET_TOKEN) &&
                                    selectedChainID === PEANUT_WALLET_CHAIN.id.toString()
                                ) && (
                                    <div className="pt-1 text-center text-xs text-grey-1">
                                        <span>Use USDC on Arbitrum for free transactions!</span>
                                    </div>
                                )}
                        </div>
                    )}

                {isDirectUsdPayment && (
                    <FileUploadInput
                        placeholder="Comment"
                        attachmentOptions={attachmentOptions}
                        setAttachmentOptions={(options) => dispatch(paymentActions.setAttachmentOptions(options))}
                        className="h-11"
                    />
                )}

                <div className="space-y-4">
                    {(showRequestPotInitialView ||
                        (isPeanutWalletConnected && (!error || isInsufficientBalanceError))) && (
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

            {showRequestPotInitialView && contributors.length > 0 && (
                <div>
                    <h2 className="mb-4 text-base font-bold text-black">Contributors ({contributors.length})</h2>
                    {contributors.map((contributor, index) => (
                        <ContributorCard
                            position={getCardPosition(index, contributors.length)}
                            key={contributor.uuid}
                            contributor={contributor}
                        />
                    ))}
                </div>
            )}

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
