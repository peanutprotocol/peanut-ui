import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PINTA_WALLET_CHAIN,
    PINTA_WALLET_TOKEN,
    PINTA_WALLET_TOKEN_DECIMALS,
    PINTA_WALLET_TOKEN_SYMBOL,
    SQUID_API_URL,
} from '@/constants'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import {
    CreateChargeRequest,
    PaymentCreationResponse,
    TCharge,
    TRequestChargeResponse,
} from '@/services/services.types'
import {
    areEvmAddressesEqual,
    ErrorHandler,
    isAddressZero,
    isNativeCurrency,
    switchNetwork as switchNetworkUtil,
} from '@/utils'
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { TransactionReceipt } from 'viem'
import { useConfig, useSendTransaction, useSwitchChain } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'

export interface InitiatePaymentPayload {
    recipient: ParsedURL['recipient']
    tokenAmount: string
    isPintaReq?: boolean
    chargeId?: string
    skipChargeCreation?: boolean
    requestId?: string // optional request ID from URL
}

interface InitiationResult {
    status: string
    charge?: TRequestChargeResponse | null
    payment?: PaymentCreationResponse | null
    error?: string | null
    txHash?: string | null
    success?: boolean
}

// hook for handling payment initiation and processing
export const usePaymentInitiator = () => {
    const dispatch = useAppDispatch()
    const { requestDetails } = usePaymentStore()
    const { selectedTokenData, selectedChainID, selectedTokenAddress } = useContext(tokenSelectorContext)
    const { isConnected: isPeanutWallet, address: peanutWalletAddress, sendTransactions } = useWallet()
    const { switchChainAsync } = useSwitchChain()
    const { setLoadingState } = useContext(loadingStateContext)
    const { address } = useAppKitAccount()
    const { chainId: currentChain } = useAppKitNetwork()
    const { sendTransactionAsync } = useSendTransaction()
    const config = useConfig()

    const [slippagePercentage, setSlippagePercentage] = useState<number | undefined>(undefined)
    const [txFee, setTxFee] = useState<string>('0')
    const [unsignedTx, setUnsignedTx] = useState<peanutInterfaces.IPeanutUnsignedTransaction | null>(null)
    const [xChainUnsignedTxs, setXChainUnsignedTxs] = useState<peanutInterfaces.IPeanutUnsignedTransaction[] | null>(
        null
    )
    const [estimatedFromValue, setEstimatedFromValue] = useState<string>('0')
    const [loadingStep, setLoadingStep] = useState<string>('Idle')
    const [error, setError] = useState<string | null>(null)
    const [createdChargeDetails, setCreatedChargeDetails] = useState<TRequestChargeResponse | null>(null)
    const [transactionHash, setTransactionHash] = useState<string | null>(null)
    const [paymentDetails, setPaymentDetails] = useState<PaymentCreationResponse | null>(null)

    const isProcessing = useMemo(
        () =>
            loadingStep !== 'Idle' &&
            loadingStep !== 'Charge Created' &&
            loadingStep !== 'Success' &&
            loadingStep !== 'Error',
        [loadingStep]
    )

    // reset states
    useEffect(() => {
        setError(null)
        setLoadingStep('Idle')
        setCreatedChargeDetails(null)
        setTransactionHash(null)
        setPaymentDetails(null)
    }, [requestDetails, selectedChainID, selectedTokenAddress])

    const handleError = useCallback(
        (err: unknown, step: string): InitiationResult => {
            console.error(`Error during ${step}:`, err)
            const errorMessage = ErrorHandler(err)
            setError(errorMessage)
            setLoadingStep('Error')
            if (createdChargeDetails && step !== 'Creating Charge') {
                const currentUrl = new URL(window.location.href)
                if (currentUrl.searchParams.get('chargeId') === createdChargeDetails.uuid) {
                    const newUrl = new URL(window.location.href)
                    newUrl.searchParams.delete('chargeId')
                    window.history.replaceState(null, '', newUrl.toString())
                }
            }
            return {
                status: 'Error',
                error: errorMessage,
                charge: createdChargeDetails,
                success: false,
            }
        },
        [createdChargeDetails]
    )

    // initiate and process payments
    const initiatePayment = useCallback(
        async (payload: InitiatePaymentPayload): Promise<InitiationResult> => {
            // reset states for new payment attempt
            setLoadingStep('Creating Charge')
            setError(null)
            setCreatedChargeDetails(null)
            setTransactionHash(null)
            setPaymentDetails(null)

            let chargeDetails: TRequestChargeResponse | null = null

            try {
                // handle existing charges if skipChargeCreation is true
                if (payload.skipChargeCreation && payload.chargeId) {
                    setLoadingStep('Preparing Transaction')
                    chargeDetails = await chargesApi.get(payload.chargeId)
                    setCreatedChargeDetails(chargeDetails)

                    // for external wallets, prepare the transaction
                    if (!isPeanutWallet) {
                        const isXChain = selectedChainID !== chargeDetails.chainId
                        const diffTokens =
                            selectedTokenData &&
                            !areEvmAddressesEqual(selectedTokenData.address, chargeDetails.tokenAddress)

                        let transactions: peanutInterfaces.IPeanutUnsignedTransaction[] = []

                        // prepare cross-chain transaction if needed
                        if (isXChain || diffTokens) {
                            if (!selectedTokenData) {
                                throw new Error('Token data not found')
                            }

                            setLoadingStep('Preparing Transaction')
                            const txData = await prepareXChainTransaction(
                                {
                                    address: selectedTokenData.address,
                                    chainId: selectedTokenData.chainId,
                                    decimals: selectedTokenData.decimals || 18,
                                },
                                {
                                    recipientAddress: chargeDetails.requestLink.recipientAddress,
                                    chainId: chargeDetails.chainId,
                                    tokenAmount: chargeDetails.tokenAmount,
                                    tokenAddress: chargeDetails.tokenAddress,
                                    tokenDecimals: chargeDetails.tokenDecimals,
                                    tokenType: Number(chargeDetails.tokenType),
                                },
                                address || peanutWalletAddress
                            )

                            if (!txData?.unsignedTxs) {
                                throw new Error('Failed to prepare cross-chain transaction')
                            }
                            setXChainUnsignedTxs(txData.unsignedTxs)
                            setEstimatedFromValue(txData.estimatedFromAmount)
                            setTxFee(txData.feeEstimation)
                            setSlippagePercentage(txData.slippagePercentage)
                            transactions = txData.unsignedTxs
                        } else {
                            // prepare same-chain transaction
                            setLoadingStep('Preparing Transaction')
                            const tx = peanut.prepareRequestLinkFulfillmentTransaction({
                                recipientAddress: chargeDetails.requestLink.recipientAddress,
                                tokenAddress: chargeDetails.tokenAddress,
                                tokenAmount: chargeDetails.tokenAmount,
                                tokenDecimals: chargeDetails.tokenDecimals,
                                tokenType: Number(chargeDetails.tokenType) as peanutInterfaces.EPeanutLinkType,
                            })

                            if (!tx?.unsignedTx) {
                                throw new Error('Failed to prepare transaction')
                            }

                            transactions = [tx.unsignedTx]
                        }

                        // check network and switch if needed
                        if (currentChain && selectedChainID !== String(currentChain)) {
                            setLoadingStep('Switching Network')
                            await switchNetworkUtil({
                                chainId: selectedChainID,
                                currentChainId: String(currentChain),
                                setLoadingState,
                                switchChainAsync: async ({ chainId: _chainId }) => {
                                    await switchChainAsync({ chainId: Number(selectedChainID) })
                                },
                            })
                        }

                        // send transaction
                        setLoadingStep('Sending Transaction')
                        let receipt: TransactionReceipt

                        if (isPeanutWallet) {
                            receipt = await sendTransactions(transactions)
                        } else {
                            const receipts = []
                            for (const tx of transactions) {
                                setLoadingStep('Signing Transaction')
                                const hash = await sendTransactionAsync({
                                    to: (tx.to ? tx.to : '') as `0x${string}`,
                                    value: tx.value ? BigInt(tx.value.toString()) : undefined,
                                    data: tx.data ? (tx.data as `0x${string}`) : undefined,
                                    chainId: Number(selectedChainID),
                                })

                                setLoadingStep('Sending Transaction')
                                const receipt = await waitForTransactionReceipt(config, {
                                    hash: hash,
                                    chainId: Number(selectedChainID),
                                })
                                receipts.push(receipt)
                            }
                            receipt = receipts[receipts.length - 1]
                        }

                        if (!receipt || !receipt.transactionHash) {
                            throw new Error('Transaction failed or hash not found')
                        }

                        const txHash = receipt.transactionHash
                        setTransactionHash(txHash)
                        dispatch(paymentActions.setTransactionHash(txHash))

                        // update payment details in backend
                        setLoadingStep('Updating Payment Status')
                        const payment = await chargesApi.createPayment({
                            chargeId: chargeDetails.uuid,
                            chainId: selectedChainID,
                            hash: txHash,
                            tokenAddress: selectedTokenData?.address || chargeDetails.tokenAddress,
                        })

                        setPaymentDetails(payment)
                        dispatch(paymentActions.setPaymentDetails(payment))

                        setLoadingStep('Success')
                        return {
                            status: 'Success',
                            charge: chargeDetails,
                            payment,
                            txHash,
                            success: true,
                        }
                    }
                } else {
                    // original flow to create a new charge
                    setLoadingStep('Creating Charge')

                    let validRequestId: string | undefined = payload.requestId
                    if (payload.requestId) {
                        try {
                            const request = await requestsApi.get(payload.requestId)
                            validRequestId = request.uuid
                        } catch (error) {
                            throw new Error('Invalid request ID')
                        }
                    } else if (!requestDetails) {
                        if (payload.isPintaReq && payload.recipient.resolvedAddress) {
                            const request = await requestsApi.create({
                                recipientAddress: payload.recipient.resolvedAddress,
                                chainId: PINTA_WALLET_CHAIN.id.toString(),
                                tokenAddress: PINTA_WALLET_TOKEN,
                                tokenType: String(peanutInterfaces.EPeanutLinkType.erc20),
                                tokenSymbol: PINTA_WALLET_TOKEN_SYMBOL,
                                tokenDecimals: PINTA_WALLET_TOKEN_DECIMALS.toString(),
                            })
                            validRequestId = request.uuid
                        } else {
                            throw new Error('Request details not found and cannot create new one for this payment type')
                        }
                    } else {
                        validRequestId = requestDetails.uuid
                    }

                    if (!validRequestId) {
                        throw new Error('Could not determine request ID')
                    }

                    const recipientChainId = payload.isPintaReq
                        ? PINTA_WALLET_CHAIN.id.toString()
                        : (requestDetails?.chainId ?? selectedChainID)
                    const recipientTokenAddress = payload.isPintaReq
                        ? PINTA_WALLET_TOKEN
                        : (requestDetails?.tokenAddress ?? selectedTokenAddress)
                    const recipientTokenSymbol = payload.isPintaReq
                        ? PINTA_WALLET_TOKEN_SYMBOL
                        : (requestDetails?.tokenSymbol ?? selectedTokenData?.symbol ?? 'TOKEN')
                    const recipientTokenDecimals = payload.isPintaReq
                        ? PINTA_WALLET_TOKEN_DECIMALS
                        : (requestDetails?.tokenDecimals ?? selectedTokenData?.decimals ?? 18)

                    const createChargeRequestPayload: CreateChargeRequest = {
                        pricing_type: 'fixed_price',
                        local_price: {
                            amount: payload.tokenAmount,
                            currency: 'USD',
                        },
                        baseUrl: window.location.origin,
                        requestId: validRequestId,
                        requestProps: {
                            chainId: recipientChainId,
                            tokenAddress: recipientTokenAddress,
                            tokenType: payload.isPintaReq
                                ? peanutInterfaces.EPeanutLinkType.erc20
                                : isNativeCurrency(recipientTokenAddress)
                                  ? peanutInterfaces.EPeanutLinkType.native
                                  : peanutInterfaces.EPeanutLinkType.erc20,
                            tokenSymbol: recipientTokenSymbol,
                            tokenDecimals: recipientTokenDecimals,
                            recipientAddress: payload.recipient.resolvedAddress,
                        },
                    }

                    const charge: TCharge = await chargesApi.create(createChargeRequestPayload)

                    console.log('Charge created response:', charge)
                    if (!charge.data.id) {
                        console.error('CRITICAL: Charge created but UUID is missing!', charge.data)
                        throw new Error('Charge created successfully, but is missing a UUID.')
                    }

                    // fetch the full charge details using the ID from the created charge
                    chargeDetails = await chargesApi.get(charge.data.id)
                    console.log('Fetched charge details with UUID:', chargeDetails.uuid)

                    dispatch(paymentActions.setChargeDetails(chargeDetails))
                    setCreatedChargeDetails(chargeDetails)

                    // Update URL with charge ID
                    const currentUrl = new URL(window.location.href)
                    if (currentUrl.searchParams.get('chargeId') !== chargeDetails.uuid) {
                        const newUrl = new URL(window.location.href)
                        newUrl.searchParams.set('chargeId', chargeDetails.uuid)
                        window.history.replaceState(
                            { ...window.history.state, as: newUrl.href, url: newUrl.href },
                            '',
                            newUrl.href
                        )
                    }
                }

                // peanut wallet payments flow
                if (isPeanutWallet && peanutWalletAddress) {
                    setLoadingStep('Preparing Transaction')

                    // PINTA requests payment flow using peanut wallet
                    if (payload.isPintaReq) {
                        console.log('Processing PINTA request')
                        // PINTA requests use PNT token on Polygon, no validation needed
                        const isSupportedChain = selectedChainID === PINTA_WALLET_CHAIN.id.toString()
                        const isSupportedToken = selectedTokenAddress.toLowerCase() === PINTA_WALLET_TOKEN.toLowerCase()

                        if (!(isSupportedChain && isSupportedToken)) {
                            throw new Error('Peanut Wallet only supports sending PNT on Polygon.')
                        }
                    } else if (isPeanutWallet) {
                        // validate token/chain for non-PINTA Peanut Wallet payments
                        const isSupportedChain = selectedChainID === PEANUT_WALLET_CHAIN.id.toString()
                        const isSupportedToken =
                            selectedTokenAddress.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase()

                        if (!(isSupportedChain && isSupportedToken)) {
                            throw new Error('Peanut Wallet only supports sending USDC on Arbitrum.')
                        }
                    }

                    // validate charge data before preparing transaction
                    if (
                        !chargeDetails.requestLink?.recipientAddress ||
                        !chargeDetails.tokenAddress ||
                        !chargeDetails.tokenAmount ||
                        chargeDetails.tokenDecimals === undefined ||
                        chargeDetails.tokenType === undefined
                    ) {
                        throw new Error('Charge data is missing required properties for transaction preparation.')
                    }

                    // prepare transaction for Peanut Wallet
                    const tx = peanut.prepareRequestLinkFulfillmentTransaction({
                        recipientAddress: chargeDetails.requestLink.recipientAddress,
                        tokenAddress: chargeDetails.tokenAddress,
                        tokenAmount: chargeDetails.tokenAmount,
                        tokenDecimals: chargeDetails.tokenDecimals,
                        tokenType: Number(chargeDetails.tokenType) as peanutInterfaces.EPeanutLinkType,
                    })

                    if (!tx?.unsignedTx) {
                        throw new Error('Failed to prepare Peanut Wallet transaction')
                    }
                    const unsignedTx = tx.unsignedTx

                    // send transaction and get receipt
                    setLoadingStep('Sending Transaction')
                    const receipt: TransactionReceipt = await sendTransactions([unsignedTx])

                    // update payment status in backend
                    setLoadingStep('Updating Payment Status')
                    const payment: PaymentCreationResponse = await chargesApi.createPayment({
                        chargeId: chargeDetails.uuid,
                        chainId: chargeDetails.chainId,
                        hash: receipt.transactionHash,
                        tokenAddress: chargeDetails.tokenAddress,
                    })

                    setLoadingStep('Success')
                    return {
                        status: 'Success',
                        charge: chargeDetails,
                        payment,
                        txHash: receipt.transactionHash,
                        success: true,
                    }
                } else {
                    // for non-Peanut wallet, just create the charge and return
                    setLoadingStep('Charge Created')
                    return { status: 'Charge Created', charge: chargeDetails }
                }
            } catch (err) {
                return handleError(err, loadingStep)
            }
        },
        [
            dispatch,
            requestDetails,
            selectedTokenData,
            selectedChainID,
            selectedTokenAddress,
            isPeanutWallet,
            peanutWalletAddress,
            sendTransactions,
            sendTransactionAsync,
            config,
            handleError,
            switchChainAsync,
            setLoadingState,
        ]
    )

    // helper function to prepare cross-chain transactions
    const prepareXChainTransaction = async (
        tokenData: {
            address: string
            chainId: string | number
            decimals: number
        },
        requestLink: {
            recipientAddress: string
            chainId: string | number
            tokenAmount: string
            tokenAddress: string
            tokenDecimals: number
            tokenType: number
        },
        senderAddress: string
    ) => {
        // validate input data
        if (!tokenData?.address || !tokenData?.chainId || !tokenData?.decimals) {
            throw new Error('Invalid token data for cross-chain transaction')
        }

        try {
            // format token amount with proper decimals
            const formattedTokenAmount = Number(requestLink.tokenAmount).toFixed(requestLink.tokenDecimals)

            // prepare link details for cross-chain transaction
            const linkDetails = {
                recipientAddress: requestLink.recipientAddress,
                chainId: requestLink.chainId.toString(),
                tokenAmount: formattedTokenAmount,
                tokenAddress: requestLink.tokenAddress,
                tokenDecimals: requestLink.tokenDecimals,
                tokenType: Number(requestLink.tokenType),
            }

            // use Peanut SDK to prepare the cross-chain transaction
            const xchainUnsignedTxs = await peanut.prepareXchainRequestFulfillmentTransaction({
                fromToken: tokenData.address,
                fromChainId: tokenData.chainId.toString(),
                senderAddress,
                squidRouterUrl: `${SQUID_API_URL}/route`,
                provider: await peanut.getDefaultProvider(tokenData.chainId.toString()),
                tokenType: isAddressZero(tokenData.address)
                    ? peanutInterfaces.EPeanutLinkType.native
                    : peanutInterfaces.EPeanutLinkType.erc20,
                fromTokenDecimals: tokenData.decimals,
                linkDetails,
            })

            if (!xchainUnsignedTxs) {
                throw new Error('Failed to prepare cross-chain transaction')
            }

            if (xchainUnsignedTxs.unsignedTxs.length > 0) {
                setXChainUnsignedTxs(xchainUnsignedTxs.unsignedTxs)
            }

            if (xchainUnsignedTxs.estimatedFromAmount) {
                setEstimatedFromValue(xchainUnsignedTxs.estimatedFromAmount)
                console.log('Setting estimated from value:', xchainUnsignedTxs.estimatedFromAmount)
            }

            if (xchainUnsignedTxs.feeEstimation) {
                setTxFee(xchainUnsignedTxs.feeEstimation)
                console.log('Setting tx fee:', xchainUnsignedTxs.feeEstimation)
            }

            if (xchainUnsignedTxs.slippagePercentage) {
                setSlippagePercentage(xchainUnsignedTxs.slippagePercentage)
                console.log('Setting slippage percentage:', xchainUnsignedTxs.slippagePercentage)
            }

            return xchainUnsignedTxs
        } catch (error) {
            // handle and format cross-chain specific errors
            console.error('Cross-chain preparation error:', error)
            // try to parse JSON errors from the SDK
            let errorBody = undefined
            try {
                errorBody = JSON.parse((error as Error).message)
            } catch (e) {
                console.log('Failed to parse error as JSON, using original error message')
            }

            // return appropriate error message
            if (errorBody && errorBody.message) {
                throw new Error(errorBody.message)
            } else {
                throw new Error(error instanceof Error ? error.message : 'Failed to estimate from amount')
            }
        }
    }

    return {
        initiatePayment,
        isProcessing,
        loadingStep,
        error,
        createdCharge: createdChargeDetails,
        transactionHash,
        paymentDetails,
        txFee,
        slippagePercentage,
        estimatedFromValue,
        xChainUnsignedTxs,
        unsignedTx,
    }
}
