'use client'

/**
 * hook for semantic request flow
 *
 * handles the full payment lifecycle for semantic url payments:
 * 1. creates a charge with recipient/amount details
 * 2. for same-chain usdc: sends directly via peanut wallet
 * 3. for cross-chain/different token: calculates route, shows confirm view
 * 4. executes swap/bridge transaction
 * 5. records payment to backend
 *
 * supports route expiry handling - auto-refreshes routes when expired
 */

import { useCallback, useMemo, useEffect, useContext, useState } from 'react'
import { type Address, type Hash } from 'viem'
import { useSemanticRequestFlowContext } from './SemanticRequestFlowContext'
import { useChargeManager } from '@/features/payments/shared/hooks/useChargeManager'
import { usePaymentRecorder } from '@/features/payments/shared/hooks/usePaymentRecorder'
import { useRouteCalculation } from '@/features/payments/shared/hooks/useRouteCalculation'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAuth } from '@/context/authContext'
import { tokenSelectorContext } from '@/context'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { ErrorHandler } from '@/utils/sdkErrorHandler.utils'
import { areEvmAddressesEqual } from '@/utils/general.utils'
import { useQueryClient } from '@tanstack/react-query'
import { TRANSACTIONS } from '@/constants/query.consts'

export function useSemanticRequestFlow() {
    const {
        amount,
        setAmount,
        usdAmount,
        setUsdAmount,
        currentView,
        setCurrentView,
        parsedUrl,
        recipient,
        chargeIdFromUrl,
        isAmountFromUrl,
        isTokenFromUrl,
        isChainFromUrl,
        attachment,
        setAttachment,
        charge,
        setCharge,
        payment,
        setPayment,
        txHash,
        setTxHash,
        error,
        setError,
        isLoading,
        setIsLoading,
        isSuccess,
        setIsSuccess,
        resetSemanticRequestFlow,
        isExternalWalletPayment,
        setIsExternalWalletPayment,
    } = useSemanticRequestFlowContext()

    const { user } = useAuth()
    const queryClient = useQueryClient()
    const { createCharge, fetchCharge, isCreating: isCreatingCharge, isFetching: isFetchingCharge } = useChargeManager()
    const { recordPayment, isRecording } = usePaymentRecorder()
    const {
        route: calculatedRoute,
        transactions: routeTransactions,
        estimatedGasCostUsd: calculatedGasCost,
        calculateRoute,
        isCalculating: isCalculatingRoute,
        isFeeEstimationError,
        error: routeError,
        reset: resetRoute,
    } = useRouteCalculation()
    const {
        isConnected,
        address: walletAddress,
        sendMoney,
        sendTransactions,
        formattedBalance,
        hasSufficientBalance,
    } = useWallet()

    // use token selector context for ui integration
    const { selectedChainID, selectedTokenAddress, selectedTokenData, setSelectedChainID, setSelectedTokenAddress } =
        useContext(tokenSelectorContext)

    // route expiry state
    const [isRouteExpired, setIsRouteExpired] = useState(false)

    const isLoggedIn = !!user?.user?.userId

    // set amount (for peanut wallet, amount is always in usd)
    const handleSetAmount = useCallback(
        (value: string) => {
            setAmount(value)
            setUsdAmount(value)
        },
        [setAmount, setUsdAmount]
    )

    // clear error
    const clearError = useCallback(() => {
        setError({ showError: false, errorMessage: '' })
    }, [setError])

    // check if payment is to peanut wallet token on peanut wallet chain (USDC on Arbitrum)
    const isSameChainSameToken = useMemo(() => {
        if (!selectedChainID || !selectedTokenAddress) return false
        return (
            selectedChainID === PEANUT_WALLET_CHAIN.id.toString() &&
            areEvmAddressesEqual(selectedTokenAddress, PEANUT_WALLET_TOKEN)
        )
    }, [selectedChainID, selectedTokenAddress])

    // check if this is cross-chain or different token
    const isXChain = useMemo(() => {
        if (!selectedChainID) return false
        return selectedChainID !== PEANUT_WALLET_CHAIN.id.toString()
    }, [selectedChainID])

    const isDiffToken = useMemo(() => {
        if (!selectedTokenAddress) return false
        return !areEvmAddressesEqual(selectedTokenAddress, PEANUT_WALLET_TOKEN)
    }, [selectedTokenAddress])

    // check if needs route (cross-chain or different token)
    const needsRoute = isXChain || isDiffToken

    // check if can proceed to confirm/payment
    const canProceed = useMemo(() => {
        if (!amount || !recipient) return false
        const amountNum = parseFloat(amount)
        if (isNaN(amountNum) || amountNum <= 0) return false
        if (!selectedTokenAddress || !selectedChainID) return false
        return true
    }, [amount, recipient, selectedTokenAddress, selectedChainID])

    // check if has sufficient balance for current amount
    const hasEnoughBalance = useMemo(() => {
        if (!amount) return false
        return hasSufficientBalance(amount)
    }, [amount, hasSufficientBalance])

    // check if should show insufficient balance error
    const isInsufficientBalance = useMemo(() => {
        return (
            isLoggedIn &&
            !!amount &&
            !hasEnoughBalance &&
            !isLoading &&
            !isCreatingCharge &&
            !isFetchingCharge &&
            !isRecording &&
            !isCalculatingRoute
        )
    }, [
        isLoggedIn,
        amount,
        hasEnoughBalance,
        isLoading,
        isCreatingCharge,
        isFetchingCharge,
        isRecording,
        isCalculatingRoute,
    ])

    // validate username recipient can only receive on arbitrum
    const validateUsernameRecipient = useCallback((): string | null => {
        if (recipient?.recipientType === 'USERNAME') {
            // for username recipients, only arbitrum is allowed
            if (selectedChainID && selectedChainID !== PEANUT_WALLET_CHAIN.id.toString()) {
                return 'Payments to Peanut usernames can only be made on Arbitrum'
            }
        }
        return null
    }, [recipient?.recipientType, selectedChainID])

    // update url with chargeId (shallow update - no re-render)
    const updateUrlWithChargeId = useCallback((chargeId: string) => {
        const currentUrl = new URL(window.location.href)
        if (currentUrl.searchParams.get('chargeId') !== chargeId) {
            currentUrl.searchParams.set('chargeId', chargeId)
            window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search)
        }
    }, [])

    // remove chargeId from url (shallow update - no re-render)
    const removeChargeIdFromUrl = useCallback(() => {
        const currentUrl = new URL(window.location.href)
        if (currentUrl.searchParams.has('chargeId')) {
            currentUrl.searchParams.delete('chargeId')
            window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search)
        }
    }, [])

    // handle payment button click - decides whether to skip confirm or not
    // - if logged in + peanut wallet + same chain/token → create charge and pay directly
    // - if logged in + peanut wallet + cross-chain/diff token → go to confirm view
    // - if not logged in → action list handles it
    const handlePayment = useCallback(
        async (
            shouldReturnAfterCreatingCharge: boolean = false,
            bypassLoginCheck: boolean = false
        ): Promise<{ success: boolean }> => {
            if (!recipient || !amount || !selectedTokenAddress || !selectedChainID || !selectedTokenData) {
                setError({ showError: true, errorMessage: 'missing required data' })
                return { success: false }
            }

            // validate username recipient
            const validationError = validateUsernameRecipient()
            if (validationError) {
                setError({ showError: true, errorMessage: validationError })
                return { success: false }
            }

            // if not logged in, don't proceed (action list handles this)
            if (!bypassLoginCheck && (!isLoggedIn || !walletAddress)) {
                setError({ showError: true, errorMessage: 'please log in to continue' })
                return { success: false }
            }

            setIsLoading(true)
            clearError()

            try {
                // step 1: use existing charge if available (from url), otherwise create new one
                let chargeResult = charge // use existing charge if loaded from chargeIdFromUrl

                if (!chargeResult) {
                    // only create new charge if we don't have one already
                    chargeResult = await createCharge({
                        tokenAmount: amount,
                        tokenAddress: selectedTokenAddress as Address,
                        chainId: selectedChainID,
                        tokenSymbol: selectedTokenData.symbol,
                        tokenDecimals: selectedTokenData.decimals,
                        recipientAddress: recipient.resolvedAddress,
                        transactionType: 'REQUEST',
                        reference: attachment.message,
                        attachment: attachment.file,
                        currencyAmount: usdAmount,
                        currencyCode: 'USD',
                    })
                    setCharge(chargeResult)
                }

                if (shouldReturnAfterCreatingCharge) {
                    setIsLoading(false)
                    return { success: true }
                }

                // step 2: decide flow based on token/chain
                // if same chain and same token (USDC on Arb) → pay directly (skip confirm)
                // if cross-chain or different token → go to confirm view
                if (isSameChainSameToken) {
                    // direct payment - same as old flow when isPeanutWallet && same token/chain
                    const txResult = await sendMoney(recipient.resolvedAddress, amount)
                    const hash = (txResult.receipt?.transactionHash ?? txResult.userOpHash) as Hash
                    setTxHash(hash)

                    // record payment
                    const paymentResult = await recordPayment({
                        chargeId: chargeResult.uuid,
                        chainId: PEANUT_WALLET_CHAIN.id.toString(),
                        txHash: hash,
                        tokenAddress: PEANUT_WALLET_TOKEN as Address,
                        payerAddress: walletAddress as Address,
                    })

                    setPayment(paymentResult)
                    setIsSuccess(true)
                    setCurrentView('STATUS')

                    // refetch history and balance to immediately show updated status
                    // invalidate first to mark as stale, then refetch to force immediate update
                    queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
                    queryClient.refetchQueries({
                        queryKey: [TRANSACTIONS],
                        type: 'active', // force refetch even if data is fresh
                    })
                    queryClient.invalidateQueries({ queryKey: ['balance'] })
                } else {
                    // cross-chain or different token → go to confirm view
                    // update url with chargeId
                    updateUrlWithChargeId(chargeResult.uuid)
                    setCurrentView('CONFIRM')
                }
                setIsLoading(false)
                return { success: true }
            } catch (err) {
                const errorMessage = ErrorHandler(err)
                setError({ showError: true, errorMessage })
                setIsLoading(false)
                return { success: false }
            }
        },
        [
            recipient,
            amount,
            usdAmount,
            attachment,
            walletAddress,
            selectedTokenAddress,
            selectedChainID,
            selectedTokenData,
            charge,
            isLoggedIn,
            isSameChainSameToken,
            validateUsernameRecipient,
            createCharge,
            sendMoney,
            recordPayment,
            queryClient,
            updateUrlWithChargeId,
            setCharge,
            setTxHash,
            setPayment,
            setIsSuccess,
            setCurrentView,
            setError,
            setIsLoading,
            clearError,
        ]
    )

    // prepare route when entering confirm view
    const prepareRoute = useCallback(async () => {
        if (!charge || !walletAddress || !selectedTokenData || !selectedChainID) return

        setIsRouteExpired(false)

        // check if charge is for same chain and same token (no route needed)
        const isChargeSameChainToken =
            charge.chainId === PEANUT_WALLET_CHAIN.id.toString() &&
            areEvmAddressesEqual(charge.tokenAddress, PEANUT_WALLET_TOKEN)

        // only calculate route if cross-chain or different token
        if (needsRoute && !isChargeSameChainToken) {
            await calculateRoute({
                source: {
                    address: walletAddress as Address,
                    tokenAddress: PEANUT_WALLET_TOKEN as Address,
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                },
                destination: {
                    recipientAddress: charge.requestLink.recipientAddress as Address,
                    tokenAddress: charge.tokenAddress as Address,
                    tokenAmount: charge.tokenAmount,
                    tokenDecimals: charge.tokenDecimals,
                    tokenType: 1, // ERC20
                    chainId: charge.chainId,
                },
                usdAmount: usdAmount || amount,
            })
        }
    }, [charge, walletAddress, selectedTokenData, selectedChainID, needsRoute, calculateRoute, usdAmount, amount])

    // fetch charge from url if chargeIdFromUrl is present but charge is not loaded
    useEffect(() => {
        if (
            chargeIdFromUrl &&
            !charge &&
            (currentView === 'INITIAL' || currentView === 'CONFIRM' || currentView === 'RECEIPT') &&
            !isFetchingCharge
        ) {
            fetchCharge(chargeIdFromUrl)
                .then((fetchedCharge) => {
                    setCharge(fetchedCharge)

                    // check if charge is already paid - if so, switch to receipt view
                    const isPaid = fetchedCharge.fulfillmentPayment?.status === 'SUCCESSFUL'
                    if (isPaid && (currentView === 'CONFIRM' || currentView === 'INITIAL')) {
                        setCurrentView('RECEIPT')
                        return
                    }

                    // set amount from charge if not already set
                    if (!amount && fetchedCharge.tokenAmount) {
                        setAmount(fetchedCharge.tokenAmount)
                        setUsdAmount(fetchedCharge.currencyAmount || fetchedCharge.tokenAmount)
                    }
                    // set token/chain from charge for token selector context
                    if (fetchedCharge.chainId) {
                        setSelectedChainID(fetchedCharge.chainId)
                    }
                    if (fetchedCharge.tokenAddress) {
                        setSelectedTokenAddress(fetchedCharge.tokenAddress)
                    }
                })
                .catch((err) => {
                    console.error('failed to fetch charge:', err)
                    setError({ showError: true, errorMessage: 'failed to load payment details' })
                })
        }
    }, [
        chargeIdFromUrl,
        charge,
        currentView,
        isFetchingCharge,
        fetchCharge,
        setCharge,
        amount,
        setAmount,
        setUsdAmount,
        setError,
        setSelectedChainID,
        setSelectedTokenAddress,
        setCurrentView,
    ])

    // call prepareRoute when entering confirm view and charge is ready
    useEffect(() => {
        if (currentView === 'CONFIRM' && charge) {
            prepareRoute()
        }
    }, [currentView, charge, prepareRoute])

    // handle route expiry - sets state, useEffect will trigger refetch
    const handleRouteExpired = useCallback(() => {
        setIsRouteExpired(true)
    }, [])

    // auto-refetch route when expired
    useEffect(() => {
        if (isRouteExpired && currentView === 'CONFIRM' && !isLoading && !isCalculatingRoute) {
            prepareRoute()
        }
    }, [isRouteExpired, currentView, isLoading, isCalculatingRoute, prepareRoute])

    // handle route near expiry - refetch immediately
    const handleRouteNearExpiry = useCallback(() => {
        if (!isLoading && !isCalculatingRoute) {
            prepareRoute()
        }
    }, [isLoading, isCalculatingRoute, prepareRoute])

    // execute payment from confirm view (handles both same-chain and cross-chain)
    const executePayment = useCallback(async () => {
        if (!recipient || !amount || !walletAddress || !charge) {
            setError({ showError: true, errorMessage: 'missing required data' })
            return
        }

        setIsLoading(true)
        clearError()

        try {
            let hash: Hash

            // check if charge is for same chain and same token (usdc on arbitrum)
            const isChargeSameChainToken =
                charge.chainId === PEANUT_WALLET_CHAIN.id.toString() &&
                areEvmAddressesEqual(charge.tokenAddress, PEANUT_WALLET_TOKEN)

            if (isChargeSameChainToken) {
                // direct payment for same-chain same-token (e.g. direct requests)
                const txResult = await sendMoney(charge.requestLink.recipientAddress as Address, charge.tokenAmount)
                hash = (txResult.receipt?.transactionHash ?? txResult.userOpHash) as Hash
            } else if (needsRoute && routeTransactions && routeTransactions.length > 0) {
                // cross-chain or token swap payment via squid route
                const txResult = await sendTransactions(
                    routeTransactions.map((tx) => ({
                        to: tx.to,
                        data: tx.data,
                        value: tx.value,
                    }))
                )
                hash = (txResult.receipt?.transactionHash ?? txResult.userOpHash) as Hash
            } else {
                throw new Error('route not ready for cross-chain payment')
            }

            setTxHash(hash)

            // record payment to backend
            const paymentResult = await recordPayment({
                chargeId: charge.uuid,
                chainId: PEANUT_WALLET_CHAIN.id.toString(),
                txHash: hash,
                tokenAddress: PEANUT_WALLET_TOKEN as Address,
                payerAddress: walletAddress as Address,
                sourceChainId: selectedChainID || undefined,
                sourceTokenAddress: selectedTokenAddress || undefined,
                sourceTokenSymbol: selectedTokenData?.symbol,
            })

            setPayment(paymentResult)
            setIsSuccess(true)
            setCurrentView('STATUS')

            // refetch history and balance to immediately show updated status
            // invalidate first to mark as stale, then refetch to force immediate update
            queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
            queryClient.refetchQueries({
                queryKey: [TRANSACTIONS],
                type: 'active', // force refetch even if data is fresh
            })
            queryClient.invalidateQueries({ queryKey: ['balance'] })
        } catch (err) {
            const errorMessage = ErrorHandler(err)
            setError({ showError: true, errorMessage })
        } finally {
            setIsLoading(false)
        }
    }, [
        recipient,
        amount,
        walletAddress,
        charge,
        needsRoute,
        routeTransactions,
        selectedChainID,
        selectedTokenAddress,
        selectedTokenData,
        sendMoney,
        sendTransactions,
        recordPayment,
        queryClient,
        setTxHash,
        setPayment,
        setIsSuccess,
        setCurrentView,
        setError,
        setIsLoading,
        clearError,
    ])

    // go back from confirm to initial
    const goBackToInitial = useCallback(() => {
        setCurrentView('INITIAL')
        setCharge(null)
        resetRoute()
        setIsRouteExpired(false)
        removeChargeIdFromUrl()
    }, [setCurrentView, setCharge, resetRoute, removeChargeIdFromUrl])

    return {
        // state
        amount,
        usdAmount,
        currentView,
        parsedUrl,
        recipient,
        chargeIdFromUrl,
        isAmountFromUrl,
        isTokenFromUrl,
        isChainFromUrl,
        attachment,
        charge,
        payment,
        txHash,
        error,
        isLoading: isLoading || isCreatingCharge || isFetchingCharge || isRecording || isCalculatingRoute,
        isSuccess,
        isFetchingCharge,
        isExternalWalletPayment,

        // route calculation state (for confirm view)
        calculatedRoute,
        routeTransactions,
        calculatedGasCost,
        isCalculatingRoute,
        isFeeEstimationError,
        routeError,
        isRouteExpired,

        // computed
        canProceed,
        hasSufficientBalance: hasEnoughBalance,
        isInsufficientBalance,
        isConnected,
        isLoggedIn,
        walletAddress,
        formattedBalance,
        isXChain,
        isDiffToken,
        needsRoute,
        isSameChainSameToken,

        // token selector (from context for ui)
        selectedChainID,
        selectedTokenAddress,
        selectedTokenData,
        setSelectedChainID,
        setSelectedTokenAddress,

        // actions
        setAmount: handleSetAmount,
        setAttachment,
        clearError,
        handlePayment,
        prepareRoute,
        executePayment,
        goBackToInitial,
        resetSemanticRequestFlow,
        setCurrentView,
        handleRouteExpired,
        handleRouteNearExpiry,
        setIsExternalWalletPayment,
    }
}
