import { useCreateLink } from '@/components/Create/useCreateLink'
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
import { areEvmAddressesEqual, ErrorHandler, isAddressZero, isNativeCurrency } from '@/utils'
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { TransactionReceipt } from 'viem'
import { useConfig, useSendTransaction, useSwitchChain, useAccount as useWagmiAccount } from 'wagmi'
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
    const { requestDetails, chargeDetails: chargeDetailsFromStore } = usePaymentStore()
    const { selectedTokenData, selectedChainID, selectedTokenAddress, setIsXChain } = useContext(tokenSelectorContext)
    const { isConnected: isPeanutWallet, address: peanutWalletAddress, sendTransactions } = useWallet()
    const { switchChainAsync } = useSwitchChain()
    const { setLoadingState } = useContext(loadingStateContext)
    const { address: wagmiAddress } = useAppKitAccount()
    const { chainId: currentChain } = useAppKitNetwork()
    const { sendTransactionAsync } = useSendTransaction()
    const config = useConfig()
    const { chain: connectedWalletChain } = useWagmiAccount()

    const [slippagePercentage, setSlippagePercentage] = useState<number | undefined>(undefined)
    const [txFee, setTxFee] = useState<string>('0')
    const [unsignedTx, setUnsignedTx] = useState<peanutInterfaces.IPeanutUnsignedTransaction | null>(null)
    const [xChainUnsignedTxs, setXChainUnsignedTxs] = useState<peanutInterfaces.IPeanutUnsignedTransaction[] | null>(
        null
    )
    const { estimateGasFee } = useCreateLink()
    const [feeOptions, setFeeOptions] = useState<any | undefined>(undefined)
    const [isFeeEstimationError, setIsFeeEstimationError] = useState<boolean>(false)

    const [isCalculatingFees, setIsCalculatingFees] = useState(false)
    const [isPreparingTx, setIsPreparingTx] = useState(false)

    const [estimatedGasCost, setEstimatedGasCost] = useState<number | undefined>(undefined)
    const [estimatedFromValue, setEstimatedFromValue] = useState<string>('0')
    const [loadingStep, setLoadingStep] = useState<string>('Idle')
    const [error, setError] = useState<string | null>(null)
    const [createdChargeDetails, setCreatedChargeDetails] = useState<TRequestChargeResponse | null>(null)
    const [transactionHash, setTransactionHash] = useState<string | null>(null)
    const [paymentDetails, setPaymentDetails] = useState<PaymentCreationResponse | null>(null)
    const [isEstimatingGas, setIsEstimatingGas] = useState(false)

    // calculate fee details
    const [feeCalculations, setFeeCalculations] = useState({
        networkFee: { expected: '0.00', max: '0.00' },
        slippage: undefined as { expected: string; max: string } | undefined,
        estimatedFee: '0.00',
        totalMax: '0.00',
    })

    // use chargeDetails from the store primarily, fallback to createdChargeDetails
    const activeChargeDetails = useMemo(
        () => chargeDetailsFromStore ?? createdChargeDetails,
        [chargeDetailsFromStore, createdChargeDetails]
    )

    const isXChain = useMemo(() => {
        if (!activeChargeDetails || !selectedChainID) return false
        return selectedChainID !== activeChargeDetails.chainId
    }, [activeChargeDetails, selectedChainID])

    const diffTokens = useMemo<boolean>(() => {
        if (!selectedTokenData || !activeChargeDetails) return false
        return !areEvmAddressesEqual(selectedTokenData.address, activeChargeDetails.tokenAddress)
    }, [selectedTokenData, activeChargeDetails])

    const isProcessing = useMemo(
        () =>
            loadingStep !== 'Idle' &&
            loadingStep !== 'Charge Created' &&
            loadingStep !== 'Success' &&
            loadingStep !== 'Error',
        [loadingStep]
    )

    const calculatedSlippage = useMemo(() => {
        if (!selectedTokenData?.price || !slippagePercentage || !estimatedFromValue) return null

        const slippageAmount = (slippagePercentage / 100) * selectedTokenData.price * Number(estimatedFromValue)

        return isNaN(slippageAmount) ? null : slippageAmount.toFixed(2)
    }, [slippagePercentage, selectedTokenData?.price, estimatedFromValue])

    // reset state
    useEffect(() => {
        setError(null)
        setLoadingStep('Idle')
        setIsFeeEstimationError(false)
        setIsCalculatingFees(false)
        setIsPreparingTx(false)
        setIsEstimatingGas(false)

        setUnsignedTx(null)
        setXChainUnsignedTxs(null)
        setEstimatedFromValue('0')
        setTxFee('0')
        setSlippagePercentage(undefined)
        setEstimatedGasCost(undefined)
        setFeeOptions(undefined)
        setFeeCalculations({
            networkFee: { expected: '0.00', max: '0.00' },
            slippage: undefined,
            estimatedFee: '0.00',
            totalMax: '0.00',
        })

        setTransactionHash(null)
        setPaymentDetails(null)
    }, [selectedChainID, selectedTokenAddress, requestDetails])

    // estimate gas fee when transaction is prepared
    useEffect(() => {
        if (!activeChargeDetails || (!unsignedTx && !xChainUnsignedTxs)) return

        setIsEstimatingGas(true)
        setIsFeeEstimationError(false)
        estimateGasFee({
            chainId: isXChain ? selectedChainID : activeChargeDetails.chainId,
            preparedTx: isXChain || diffTokens ? xChainUnsignedTxs : unsignedTx,
        })
            .then(({ transactionCostUSD, feeOptions: calculatedFeeOptions }) => {
                if (transactionCostUSD) setEstimatedGasCost(transactionCostUSD)
                if (calculatedFeeOptions) setFeeOptions(calculatedFeeOptions)
            })
            .catch((error) => {
                console.error('Error calculating transaction cost:', error)
                setIsFeeEstimationError(true)
                setError('Failed to estimate gas fee')
            })
            .finally(() => {
                setIsEstimatingGas(false)
            })
    }, [unsignedTx, xChainUnsignedTxs, activeChargeDetails, isXChain, diffTokens, selectedChainID, estimateGasFee])

    // calculate display fees
    useEffect(() => {
        if (!activeChargeDetails || !selectedTokenData || isEstimatingGas || isPreparingTx) {
            return
        }

        const EXPECTED_NETWORK_FEE_MULTIPLIER = 0.7
        const EXPECTED_SLIPPAGE_MULTIPLIER = 0.1
        setIsCalculatingFees(true)

        try {
            const networkFee = {
                expected:
                    (isXChain || diffTokens
                        ? parseFloat(txFee) * EXPECTED_NETWORK_FEE_MULTIPLIER
                        : isPeanutWallet
                          ? 0
                          : Number(estimatedGasCost || 0)) * EXPECTED_NETWORK_FEE_MULTIPLIER,
                max: isXChain || diffTokens ? parseFloat(txFee) : isPeanutWallet ? 0 : Number(estimatedGasCost || 0),
            }

            const slippage =
                (isXChain || diffTokens) && calculatedSlippage
                    ? {
                          expected: Number(calculatedSlippage) * EXPECTED_SLIPPAGE_MULTIPLIER,
                          max: Number(calculatedSlippage),
                      }
                    : undefined

            const totalMax =
                Number(estimatedFromValue) * selectedTokenData!.price + networkFee.max + (slippage?.max || 0)

            const formatNumberSafely = (num: number) => {
                if (isNaN(num) || !isFinite(num)) return '0.00'
                return num < 0.01 && num > 0 ? '0.01' : num.toFixed(2)
            }

            setFeeCalculations({
                networkFee: {
                    expected: formatNumberSafely(networkFee.expected),
                    max: formatNumberSafely(networkFee.max),
                },
                slippage: slippage
                    ? {
                          expected: formatNumberSafely(slippage.expected),
                          max: formatNumberSafely(slippage.max),
                      }
                    : undefined,
                estimatedFee: formatNumberSafely(networkFee.expected + (slippage?.expected || 0)),
                totalMax: formatNumberSafely(totalMax),
            })
        } catch (error) {
            console.error('Error calculating fees:', error)
            setIsFeeEstimationError(true)
            setError('Failed to calculate fees')
            setFeeCalculations({
                networkFee: { expected: '0.00', max: '0.00' },
                slippage: undefined,
                estimatedFee: '0.00',
                totalMax: '0.00',
            })
        } finally {
            const timer = setTimeout(() => {
                setIsCalculatingFees(false)
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [
        isXChain,
        diffTokens,
        txFee,
        calculatedSlippage,
        activeChargeDetails,
        selectedTokenData,
        isPeanutWallet,
        estimatedGasCost,
        estimatedFromValue,
        isEstimatingGas,
        isPreparingTx,
    ])

    const handleError = useCallback(
        (err: unknown, step: string): InitiationResult => {
            console.error(`Error during ${step}:`, err)
            const errorMessage = ErrorHandler(err)
            setError(errorMessage)
            setLoadingStep('Error')
            if (activeChargeDetails && step !== 'Creating Charge') {
                const currentUrl = new URL(window.location.href)
                if (currentUrl.searchParams.get('chargeId') === activeChargeDetails.uuid) {
                    const newUrl = new URL(window.location.href)
                    newUrl.searchParams.delete('chargeId')
                    window.history.replaceState(null, '', newUrl.toString())
                }
            }
            return {
                status: 'Error',
                error: errorMessage,
                charge: activeChargeDetails,
                success: false,
            }
        },
        [activeChargeDetails]
    )

    // prepare transaction details (called from Confirm view)
    const prepareTransactionDetails = useCallback(
        async (chargeDetails: TRequestChargeResponse) => {
            if (!selectedTokenData || (!peanutWalletAddress && !wagmiAddress)) {
                console.warn('Missing data for transaction preparation')
                return
            }

            setError(null)
            setIsFeeEstimationError(false)
            setUnsignedTx(null)
            setXChainUnsignedTxs(null)

            setEstimatedGasCost(undefined)
            setFeeOptions(undefined)
            setFeeCalculations({
                networkFee: { expected: '0.00', max: '0.00' },
                slippage: undefined,
                estimatedFee: '0.00',
                totalMax: '0.00',
            })

            if (isPeanutWallet) {
                setEstimatedFromValue(chargeDetails.tokenAmount)
                setIsPreparingTx(false)
                return
            }

            setIsPreparingTx(true)

            try {
                const _isXChain = selectedChainID !== chargeDetails.chainId
                const _diffTokens = !areEvmAddressesEqual(selectedTokenData.address, chargeDetails.tokenAddress)
                setIsXChain(_isXChain)

                if (_isXChain || _diffTokens) {
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
                        peanutWalletAddress ?? wagmiAddress!
                    )

                    if (!txData?.unsignedTxs) {
                        throw new Error('Failed to prepare cross-chain transaction')
                    }

                    setXChainUnsignedTxs(txData.unsignedTxs)
                    setEstimatedFromValue(txData.estimatedFromAmount)
                    setTxFee(txData.feeEstimation)
                    setSlippagePercentage(txData.slippagePercentage)
                } else {
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

                    setUnsignedTx(tx.unsignedTx)
                    setEstimatedFromValue(chargeDetails.tokenAmount)
                    setTxFee('0')
                    setSlippagePercentage(undefined)
                }
                setLoadingStep('Idle')
            } catch (err) {
                console.error('Error preparing transaction details:', err)
                const errorMessage = ErrorHandler(err)
                setError(errorMessage)
                setIsFeeEstimationError(true)
                setLoadingStep('Error')
            } finally {
                setIsPreparingTx(false)
            }
        },
        [
            selectedTokenData,
            selectedChainID,
            peanutWalletAddress,
            wagmiAddress,
            setIsXChain,
            isPeanutWallet,
            selectedTokenAddress,
        ]
    )

    // initiate and process payments
    const initiatePayment = useCallback(
        async (payload: InitiatePaymentPayload): Promise<InitiationResult> => {
            setLoadingStep('Idle')
            setError(null)
            setTransactionHash(null)
            setPaymentDetails(null)

            let chargeDetailsToUse: TRequestChargeResponse | null = null

            try {
                if (payload.skipChargeCreation && payload.chargeId) {
                    chargeDetailsToUse = activeChargeDetails
                    if (!chargeDetailsToUse || chargeDetailsToUse.uuid !== payload.chargeId) {
                        setLoadingStep('Fetching Charge Details')
                        chargeDetailsToUse = await chargesApi.get(payload.chargeId)
                        setCreatedChargeDetails(chargeDetailsToUse)
                    }
                } else {
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

                    if (!charge.data.id) {
                        console.error('CRITICAL: Charge created but UUID is missing!', charge.data)
                        throw new Error('Charge created successfully, but is missing a UUID.')
                    }

                    chargeDetailsToUse = await chargesApi.get(charge.data.id)
                    dispatch(paymentActions.setChargeDetails(chargeDetailsToUse))
                    setCreatedChargeDetails(chargeDetailsToUse)

                    const currentUrl = new URL(window.location.href)
                    if (currentUrl.searchParams.get('chargeId') !== chargeDetailsToUse.uuid) {
                        const newUrl = new URL(window.location.href)
                        newUrl.searchParams.set('chargeId', chargeDetailsToUse.uuid)
                        window.history.replaceState(
                            { ...window.history.state, as: newUrl.href, url: newUrl.href },
                            '',
                            newUrl.href
                        )
                    }
                }

                if (!chargeDetailsToUse) {
                    throw new Error('Failed to load or create charge details.')
                }

                if (isPeanutWallet && peanutWalletAddress) {
                    setLoadingStep('Preparing Transaction')

                    const isSupportedChain =
                        selectedChainID === PEANUT_WALLET_CHAIN.id.toString() ||
                        selectedChainID === PINTA_WALLET_CHAIN.id.toString()
                    const isSupportedToken =
                        selectedTokenAddress.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase() ||
                        selectedTokenAddress.toLowerCase() === PINTA_WALLET_TOKEN.toLowerCase()

                    if (!(isSupportedChain && isSupportedToken)) {
                        throw new Error('Peanut Wallet only supports sending USDC on Arbitrum.')
                    }

                    // validate charge data before preparing transaction
                    if (
                        !chargeDetailsToUse.requestLink?.recipientAddress ||
                        !chargeDetailsToUse.tokenAddress ||
                        !chargeDetailsToUse.tokenAmount ||
                        chargeDetailsToUse.tokenDecimals === undefined ||
                        chargeDetailsToUse.tokenType === undefined
                    ) {
                        throw new Error('Charge data is missing required properties for transaction preparation.')
                    }

                    // prepare transaction for Peanut Wallet
                    const tx = peanut.prepareRequestLinkFulfillmentTransaction({
                        recipientAddress: chargeDetailsToUse.requestLink.recipientAddress,
                        tokenAddress: chargeDetailsToUse.tokenAddress,
                        tokenAmount: chargeDetailsToUse.tokenAmount,
                        tokenDecimals: chargeDetailsToUse.tokenDecimals,
                        tokenType: Number(chargeDetailsToUse.tokenType) as peanutInterfaces.EPeanutLinkType,
                    })

                    if (!tx?.unsignedTx) {
                        throw new Error('Failed to prepare Peanut Wallet transaction')
                    }
                    const peanutUnsignedTx = tx.unsignedTx

                    // send transaction and get receipt

                    setLoadingStep('Sending Transaction')
                    const receipt: TransactionReceipt = await sendTransactions([peanutUnsignedTx])

                    // update payment status in backend
                    setLoadingStep('Updating Payment Status')
                    const payment: PaymentCreationResponse = await chargesApi.createPayment({
                        chargeId: chargeDetailsToUse.uuid,
                        chainId: chargeDetailsToUse.chainId,
                        hash: receipt.transactionHash,
                        tokenAddress: chargeDetailsToUse.tokenAddress,
                    })

                    setPaymentDetails(payment)
                    dispatch(paymentActions.setPaymentDetails(payment))
                    dispatch(paymentActions.setTransactionHash(receipt.transactionHash))

                    setLoadingStep('Success')
                    return {
                        status: 'Success',
                        charge: chargeDetailsToUse,
                        payment,
                        txHash: receipt.transactionHash,
                        success: true,
                    }
                } else if (!isPeanutWallet && payload.skipChargeCreation) {
                    if (!unsignedTx && !xChainUnsignedTxs) {
                        console.warn('Transaction details not prepared, attempting now...')
                        setLoadingStep('Preparing Transaction')
                        await prepareTransactionDetails(chargeDetailsToUse)
                        if (!unsignedTx && !xChainUnsignedTxs) {
                            return handleError(
                                new Error('Transaction details could not be prepared.'),
                                'Preparing Transaction'
                            )
                        }
                        setLoadingStep('Idle')
                    }

                    const sourceChainId = Number(selectedChainID)
                    const connectedChainId = connectedWalletChain?.id

                    if (connectedChainId !== undefined && sourceChainId !== connectedChainId) {
                        setLoadingStep('Switching Network')
                        try {
                            await switchChainAsync({ chainId: sourceChainId })
                        } catch (switchError) {
                            console.error('Wallet network switch failed:', switchError)
                            return handleError(
                                new Error(
                                    `Failed to switch network to chain ${sourceChainId}. Please switch manually in your wallet.`
                                ),
                                'Switching Network'
                            )
                        }
                        setLoadingStep('Idle')
                    }

                    const transactionsToSend = xChainUnsignedTxs ?? (unsignedTx ? [unsignedTx] : null)
                    if (!transactionsToSend) {
                        return handleError(new Error('No transaction prepared to send.'), loadingStep)
                    }

                    setLoadingStep('Sending Transaction')
                    let receipt: TransactionReceipt
                    const receipts = []
                    try {
                        for (const tx of transactionsToSend) {
                            setLoadingStep('Signing Transaction')

                            let hash = await sendTransactionAsync({
                                to: (tx.to ? tx.to : '') as `0x${string}`,
                                value: tx.value ? BigInt(tx.value.toString()) : undefined,
                                data: tx.data ? (tx.data as `0x${string}`) : undefined,
                                gas: feeOptions?.gas ? BigInt(feeOptions.gas.toString()) : undefined,
                                gasPrice: feeOptions?.gasPrice ? BigInt(feeOptions.gasPrice.toString()) : undefined,
                                maxFeePerGas: feeOptions?.maxFeePerGas
                                    ? BigInt(feeOptions?.maxFeePerGas.toString())
                                    : undefined,
                                maxPriorityFeePerGas: feeOptions?.maxPriorityFeePerGas
                                    ? BigInt(feeOptions?.maxPriorityFeePerGas.toString())
                                    : undefined,
                                chainId: sourceChainId,
                            })

                            setLoadingStep('Sending Transaction')

                            const txReceipt = await waitForTransactionReceipt(config, {
                                hash: hash,
                                chainId: sourceChainId,
                            })
                            receipts.push(txReceipt)
                        }
                        receipt = receipts[receipts.length - 1]

                        if (!receipt || !receipt.transactionHash) {
                            throw new Error('Transaction sequence completed, but final hash not found')
                        }
                    } catch (txError: any) {
                        console.error(`Transaction failed during ${loadingStep}:`, txError)
                        if (txError.message?.includes('does not match the target chain')) {
                            return handleError(
                                new Error(
                                    `Wallet connection issue: Ensure your wallet is connected to ${sourceChainId}.`
                                ),
                                loadingStep
                            )
                        }
                        return handleError(txError, loadingStep)
                    }

                    const txHash = receipt.transactionHash
                    setTransactionHash(txHash)
                    dispatch(paymentActions.setTransactionHash(txHash))

                    setLoadingStep('Updating Payment Status')
                    const payment = await chargesApi.createPayment({
                        chargeId: chargeDetailsToUse.uuid,
                        chainId: sourceChainId.toString(),
                        hash: txHash,
                        tokenAddress: selectedTokenData?.address || chargeDetailsToUse.tokenAddress,
                    })

                    setPaymentDetails(payment)
                    dispatch(paymentActions.setPaymentDetails(payment))

                    setLoadingStep('Success')
                    return {
                        status: 'Success',
                        charge: chargeDetailsToUse,
                        payment,
                        txHash,
                        success: true,
                    }
                } else if (!isPeanutWallet && !payload.skipChargeCreation) {
                    setLoadingStep('Charge Created')
                    return { status: 'Charge Created', charge: chargeDetailsToUse, success: false }
                } else {
                    throw new Error('Invalid payment state')
                }
            } catch (err) {
                return handleError(err, loadingStep)
            }
        },
        [
            dispatch,
            requestDetails,
            activeChargeDetails,
            selectedTokenData,
            selectedChainID,
            selectedTokenAddress,
            isPeanutWallet,
            peanutWalletAddress,
            wagmiAddress,
            sendTransactions,
            sendTransactionAsync,
            config,
            handleError,
            switchChainAsync,
            setLoadingState,
            connectedWalletChain,
            prepareTransactionDetails,
            unsignedTx,
            xChainUnsignedTxs,
            feeOptions,
        ]
    )

    // helper function to prepare cross-chain transactions
    const prepareXChainTransaction = useCallback(
        async (
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
            if (!tokenData?.address || !tokenData?.chainId || tokenData?.decimals === undefined) {
                throw new Error('Invalid token data for cross-chain transaction')
            }

            try {
                const formattedTokenAmount = Number(requestLink.tokenAmount).toFixed(requestLink.tokenDecimals)

                const linkDetails = {
                    recipientAddress: requestLink.recipientAddress,
                    chainId: requestLink.chainId.toString(),
                    tokenAmount: formattedTokenAmount,
                    tokenAddress: requestLink.tokenAddress,
                    tokenDecimals: requestLink.tokenDecimals,
                    tokenType: Number(requestLink.tokenType),
                }

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
                    throw new Error('Failed to prepare cross-chain transaction (SDK returned null/undefined)')
                }

                return xchainUnsignedTxs
            } catch (error) {
                console.error('Cross-chain preparation error:', error)
                let errorBody = undefined
                try {
                    if (error instanceof Error && error.message.startsWith('{')) {
                        errorBody = JSON.parse(error.message)
                    } else if (typeof (error as any)?.body === 'string' && (error as any).body.startsWith('{')) {
                        errorBody = JSON.parse((error as any).body)
                        if (errorBody?.error?.message) errorBody.message = errorBody.error.message
                    }
                } catch (e) {
                    console.log('Failed to parse error as JSON, using original error message')
                }

                if (errorBody && errorBody.message) {
                    const code = errorBody.code || errorBody.errorCode || (error as any).code
                    throw new Error(`Cross-chain prep failed: ${errorBody.message}${code ? ` (Code: ${code})` : ''}`)
                } else {
                    throw new Error(
                        error instanceof Error ? error.message : 'Failed to estimate cross-chain transaction details'
                    )
                }
            }
        },
        []
    )

    return {
        initiatePayment,
        prepareTransactionDetails,
        isProcessing,
        isPreparingTx,
        loadingStep,
        error,
        activeChargeDetails,
        transactionHash,
        paymentDetails,
        txFee,
        slippagePercentage,
        estimatedFromValue,
        xChainUnsignedTxs,
        unsignedTx,
        feeCalculations,
        isCalculatingFees,
        isFeeEstimationError,
        isEstimatingGas,
        isXChain,
        diffTokens,
    }
}
