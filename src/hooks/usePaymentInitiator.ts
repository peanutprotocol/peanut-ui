import type { FeeOptions } from '@/app/actions/clients'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PINTA_WALLET_CHAIN,
    PINTA_WALLET_TOKEN,
    PINTA_WALLET_TOKEN_DECIMALS,
    PINTA_WALLET_TOKEN_SYMBOL,
} from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { IAttachmentOptions } from '@/redux/types/send-flow.types'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import {
    CreateChargeRequest,
    PaymentCreationResponse,
    TCharge,
    TChargeTransactionType,
    TRequestChargeResponse,
} from '@/services/services.types'
import { areEvmAddressesEqual, ErrorHandler, isNativeCurrency } from '@/utils'
import { useAppKitAccount } from '@reown/appkit/react'
import { peanut, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { parseUnits } from 'viem'
import type { TransactionReceipt, Address, Hex } from 'viem'
import { useConfig, useSendTransaction, useSwitchChain, useAccount as useWagmiAccount } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { getRoute, type PeanutCrossChainRoute } from '@/services/swap'
import { estimateTransactionCostUsd } from '@/app/actions/tokens'

export interface InitiatePaymentPayload {
    recipient: ParsedURL['recipient']
    tokenAmount: string
    isPintaReq?: boolean
    chargeId?: string
    skipChargeCreation?: boolean
    requestId?: string // optional request ID from URL
    currency?: {
        code: string
        symbol: string
        price: number
    }
    currencyAmount?: string
    isAddMoneyFlow?: boolean
    transactionType?: TChargeTransactionType
    attachmentOptions?: IAttachmentOptions
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
    const { address: wagmiAddress } = useAppKitAccount()
    const { sendTransactionAsync } = useSendTransaction()
    const config = useConfig()
    const { chain: connectedWalletChain } = useWagmiAccount()

    const [slippagePercentage, setSlippagePercentage] = useState<number | undefined>(undefined)
    const [unsignedTx, setUnsignedTx] = useState<peanutInterfaces.IPeanutUnsignedTransaction | null>(null)
    const [xChainUnsignedTxs, setXChainUnsignedTxs] = useState<peanutInterfaces.IPeanutUnsignedTransaction[] | null>(
        null
    )
    const [feeOptions, setFeeOptions] = useState<Partial<FeeOptions>[]>([])
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
    const [xChainRoute, setXChainRoute] = useState<PeanutCrossChainRoute | undefined>(undefined)

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

    const isProcessing = useMemo<boolean>(
        () => loadingStep !== 'Idle' && loadingStep !== 'Success' && loadingStep !== 'Error',
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
        setXChainRoute(undefined)
        setEstimatedFromValue('0')
        setSlippagePercentage(undefined)
        setEstimatedGasCost(undefined)
        setFeeOptions([])
        setTransactionHash(null)
        setPaymentDetails(null)
    }, [selectedChainID, selectedTokenAddress, requestDetails])

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
        async (
            chargeDetails: TRequestChargeResponse,
            fromTokenAddress?: string,
            fromChainId?: string,
            usdAmount?: string
        ) => {
            // Default to selected token/chain if not provided
            const actualFromTokenAddress = fromTokenAddress ?? selectedTokenData?.address
            const actualFromChainId = fromChainId ?? selectedChainID

            if (
                !selectedTokenData ||
                (!peanutWalletAddress && !wagmiAddress) ||
                !actualFromTokenAddress ||
                !actualFromChainId
            ) {
                console.warn('Missing data for transaction preparation')
                return
            }

            setError(null)
            setIsFeeEstimationError(false)
            setUnsignedTx(null)
            setXChainUnsignedTxs(null)
            setXChainRoute(undefined)

            setEstimatedGasCost(undefined)
            setFeeOptions([])
            setIsPreparingTx(true)

            try {
                const _isXChain = actualFromChainId !== chargeDetails.chainId
                const _diffTokens = !areEvmAddressesEqual(actualFromTokenAddress, chargeDetails.tokenAddress)
                setIsXChain(_isXChain)

                if (_isXChain || _diffTokens) {
                    setLoadingStep('Preparing Transaction')
                    const senderAddress = isPeanutWallet ? peanutWalletAddress : wagmiAddress
                    setIsCalculatingFees(true)
                    const amount = usdAmount
                        ? {
                              fromUsd: usdAmount,
                          }
                        : {
                              toAmount: parseUnits(chargeDetails.tokenAmount, chargeDetails.tokenDecimals),
                          }
                    const xChainRoute = await getRoute({
                        from: {
                            address: senderAddress as Address,
                            tokenAddress: actualFromTokenAddress as Address,
                            chainId: actualFromChainId,
                        },
                        to: {
                            address: chargeDetails.requestLink.recipientAddress as Address,
                            tokenAddress: chargeDetails.tokenAddress as Address,
                            chainId: chargeDetails.chainId,
                        },
                        ...amount,
                    })

                    const slippagePercentage = Number(xChainRoute.fromAmount) / Number(chargeDetails.tokenAmount) - 1
                    setXChainRoute(xChainRoute)
                    setXChainUnsignedTxs(
                        xChainRoute.transactions.map((tx) => ({
                            to: tx.to,
                            data: tx.data,
                            value: BigInt(tx.value),
                        }))
                    )
                    setIsCalculatingFees(false)
                    setEstimatedGasCost(xChainRoute.feeCostsUsd)
                    setEstimatedFromValue(xChainRoute.fromAmount)
                    setSlippagePercentage(slippagePercentage)
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

                    setIsCalculatingFees(true)
                    setEstimatedGasCost(
                        await estimateTransactionCostUsd(
                            tx.unsignedTx.from! as Address,
                            tx.unsignedTx.to! as Address,
                            tx.unsignedTx.data! as Hex,
                            selectedChainID
                        )
                    )
                    setIsCalculatingFees(false)
                    setUnsignedTx(tx.unsignedTx)
                    setEstimatedFromValue(chargeDetails.tokenAmount)
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

    // helper function: determine charge details (fetch or create)
    const determineChargeDetails = useCallback(
        async (
            payload: InitiatePaymentPayload
        ): Promise<{ chargeDetails: TRequestChargeResponse; chargeCreated: boolean }> => {
            let chargeDetailsToUse: TRequestChargeResponse | null = null
            let chargeCreated = false

            if (payload.chargeId) {
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
                        console.error('Invalid request ID provided:', payload.requestId, error)
                        throw new Error('Invalid request ID')
                    }
                } else if (!requestDetails) {
                    if (payload.isPintaReq && payload.recipient?.resolvedAddress) {
                        console.log(
                            'Request details missing, creating new Pinta request for:',
                            payload.recipient.resolvedAddress
                        )
                        try {
                            const request = await requestsApi.create({
                                recipientAddress: payload.recipient.resolvedAddress,
                                chainId: PINTA_WALLET_CHAIN.id.toString(),
                                tokenAddress: PINTA_WALLET_TOKEN,
                                tokenType: String(peanutInterfaces.EPeanutLinkType.erc20),
                                tokenSymbol: PINTA_WALLET_TOKEN_SYMBOL,
                                tokenDecimals: String(PINTA_WALLET_TOKEN_DECIMALS),
                            })
                            validRequestId = request.uuid
                            console.log('Created new Pinta request:', validRequestId)
                        } catch (creationError) {
                            console.error('Failed to create Pinta request:', creationError)
                            throw new Error('Failed to automatically create Pinta request.')
                        }
                    } else {
                        console.error('Request details not found and cannot create new one for this payment type.')
                        throw new Error('Request details not found.')
                    }
                } else {
                    validRequestId = requestDetails.uuid
                }

                if (!validRequestId) {
                    console.error('Could not determine request ID for charge creation.')
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

                const localPrice =
                    payload.currencyAmount && payload.currency
                        ? { amount: payload.currencyAmount, currency: payload.currency.code }
                        : { amount: payload.tokenAmount, currency: 'USD' }
                const createChargeRequestPayload: CreateChargeRequest = {
                    pricing_type: 'fixed_price',
                    local_price: localPrice,
                    baseUrl: window.location.origin,
                    requestId: validRequestId,
                    requestProps: {
                        chainId: recipientChainId,
                        tokenAmount: payload.tokenAmount,
                        tokenAddress: recipientTokenAddress,
                        tokenType: payload.isPintaReq
                            ? peanutInterfaces.EPeanutLinkType.erc20
                            : isNativeCurrency(recipientTokenAddress)
                              ? peanutInterfaces.EPeanutLinkType.native
                              : peanutInterfaces.EPeanutLinkType.erc20,
                        tokenSymbol: recipientTokenSymbol,
                        tokenDecimals: Number(recipientTokenDecimals),
                        recipientAddress: payload.recipient?.resolvedAddress,
                    },
                    transactionType: payload.transactionType,
                }

                // add attachment if present
                if (payload.attachmentOptions?.rawFile) {
                    createChargeRequestPayload.attachment = payload.attachmentOptions.rawFile
                    createChargeRequestPayload.filename = payload.attachmentOptions.rawFile.name
                }
                if (payload.attachmentOptions?.message) {
                    createChargeRequestPayload.reference = payload.attachmentOptions.message
                }

                if (payload.attachmentOptions?.rawFile?.type) {
                    createChargeRequestPayload.mimeType = payload.attachmentOptions.rawFile.type
                }

                console.log('Creating charge with payload:', createChargeRequestPayload)
                const charge: TCharge = await chargesApi.create(createChargeRequestPayload)
                console.log('Charge created response:', charge)

                if (!charge.data.id) {
                    console.error('CRITICAL: Charge created but UUID (ID) is missing!', charge.data)
                    throw new Error('Charge created successfully, but is missing a UUID.')
                }

                // fetch the charge using the correct ID field from the response
                chargeDetailsToUse = await chargesApi.get(charge.data.id)
                console.log('Fetched charge details:', chargeDetailsToUse)

                dispatch(paymentActions.setChargeDetails(chargeDetailsToUse))
                setCreatedChargeDetails(chargeDetailsToUse) // keep track of the newly created charge
                chargeCreated = true

                // update URL
                const currentUrl = new URL(window.location.href)
                if (currentUrl.searchParams.get('chargeId') !== chargeDetailsToUse.uuid) {
                    const newUrl = new URL(window.location.href)
                    if (payload.requestId) newUrl.searchParams.delete('id')
                    newUrl.searchParams.set('chargeId', chargeDetailsToUse.uuid)
                    window.history.replaceState(
                        { ...window.history.state, as: newUrl.href, url: newUrl.href },
                        '',
                        newUrl.href
                    )
                    console.log('Updated URL with chargeId:', newUrl.href)
                }
            }

            // ensure we have charge details to proceed
            if (!chargeDetailsToUse) {
                console.error('Charge details are null after determination step.')
                throw new Error('Failed to load or create charge details.')
            }

            return { chargeDetails: chargeDetailsToUse, chargeCreated }
        },
        [dispatch, requestDetails, activeChargeDetails, selectedTokenData, selectedChainID, selectedTokenAddress]
    )

    // helper function: Handle Peanut Wallet payment
    const handlePeanutWalletPayment = useCallback(
        async (chargeDetails: TRequestChargeResponse): Promise<InitiationResult> => {
            setLoadingStep('Preparing Transaction')

            // validate required properties for preparing the transaction.
            if (
                !chargeDetails.requestLink?.recipientAddress ||
                !chargeDetails.tokenAddress ||
                !chargeDetails.tokenAmount ||
                chargeDetails.tokenDecimals === undefined ||
                chargeDetails.tokenType === undefined
            ) {
                console.error('Charge data is missing required properties for transaction preparation:', chargeDetails)
                throw new Error('Charge data is missing required properties for transaction preparation.')
            }

            const transactionsToSend = xChainUnsignedTxs ?? (unsignedTx ? [unsignedTx] : null)
            if (!transactionsToSend || transactionsToSend.length === 0) {
                console.error('No transaction prepared to send for peanut wallet.')
                throw new Error('No transaction prepared to send.')
            }
            console.log('Transactions prepared for sending:', transactionsToSend)

            setLoadingStep('Sending Transaction')

            const receipt: TransactionReceipt = await sendTransactions(
                transactionsToSend,
                PEANUT_WALLET_CHAIN.id.toString()
            )

            // validation of the received receipt.
            if (!receipt || !receipt.transactionHash) {
                console.error('sendTransactions returned invalid receipt (missing hash?):', receipt)
                throw new Error('Transaction likely failed or was not submitted correctly by the wallet.')
            }
            if (receipt.status === 'reverted') {
                console.error('Transaction reverted according to receipt:', receipt)
                throw new Error(`Transaction failed (reverted). Hash: ${receipt.transactionHash}`)
            }

            // update payment status in the backend api.
            setLoadingStep('Updating Payment Status')
            const payment: PaymentCreationResponse = await chargesApi.createPayment({
                chargeId: chargeDetails.uuid,
                chainId: PEANUT_WALLET_CHAIN.id.toString(),
                hash: receipt.transactionHash,
                tokenAddress: PEANUT_WALLET_TOKEN,
            })
            console.log('Backend payment creation response:', payment)

            setPaymentDetails(payment)
            dispatch(paymentActions.setPaymentDetails(payment))
            dispatch(paymentActions.setTransactionHash(receipt.transactionHash))

            setLoadingStep('Success')
            console.log('Peanut Wallet payment successful.')
            return { status: 'Success', charge: chargeDetails, payment, txHash: receipt.transactionHash, success: true }
        },
        [sendTransactions, xChainUnsignedTxs, unsignedTx]
    )

    // helper function: Handle External Wallet payment
    const handleExternalWalletPayment = useCallback(
        async (chargeDetails: TRequestChargeResponse): Promise<InitiationResult> => {
            const sourceChainId = Number(selectedChainID)
            const connectedChainId = connectedWalletChain?.id
            console.log(`Selected chain: ${sourceChainId}, Connected chain: ${connectedChainId}`)

            if (connectedChainId !== undefined && sourceChainId !== connectedChainId) {
                console.log(`Switching network from ${connectedChainId} to ${sourceChainId}`)
                setLoadingStep('Switching Network')
                try {
                    await switchChainAsync({ chainId: sourceChainId })
                    console.log(`Network switched successfully to ${sourceChainId}`)
                } catch (switchError: any) {
                    console.error('Wallet network switch failed:', switchError)
                    const message =
                        switchError.shortMessage ||
                        `Failed to switch network to chain ${sourceChainId}. Please switch manually in your wallet.`
                    throw new Error(message) // throw error, to be caught by main initiatePayment function
                }
            }

            const transactionsToSend = xChainUnsignedTxs ?? (unsignedTx ? [unsignedTx] : null)
            if (!transactionsToSend || transactionsToSend.length === 0) {
                console.error('No transaction prepared to send for external wallet.')
                throw new Error('No transaction prepared to send.')
            }
            console.log('Transactions prepared for sending:', transactionsToSend)

            let receipt: TransactionReceipt
            const receipts: TransactionReceipt[] = []
            let currentStep = 'Sending Transaction'

            try {
                for (let i = 0; i < transactionsToSend.length; i++) {
                    const tx = transactionsToSend[i]
                    console.log(`Sending transaction ${i + 1}/${transactionsToSend.length}:`, tx)
                    setLoadingStep(`Sending Transaction`)
                    currentStep = 'Sending Transaction'

                    const txGasOptions: any = {}
                    const gasOptions = feeOptions[i]
                    if (gasOptions) {
                        if (gasOptions.gas) txGasOptions.gas = BigInt(gasOptions.gas.toString())
                        if (gasOptions.maxFeePerGas)
                            txGasOptions.maxFeePerGas = BigInt(gasOptions.maxFeePerGas.toString())
                        if (gasOptions.maxPriorityFeePerGas)
                            txGasOptions.maxPriorityFeePerGas = BigInt(gasOptions.maxPriorityFeePerGas.toString())
                    }
                    console.log('Using gas options:', txGasOptions)

                    const hash = await sendTransactionAsync({
                        to: (tx.to ? tx.to : undefined) as `0x${string}` | undefined,
                        value: tx.value ? BigInt(tx.value.toString()) : undefined,
                        data: tx.data ? (tx.data as `0x${string}`) : undefined,
                        ...txGasOptions,
                        chainId: sourceChainId,
                    })
                    console.log(`Transaction ${i + 1} hash: ${hash}`)

                    setLoadingStep(`Confirming Transaction`)
                    currentStep = 'Confirming Transaction'

                    const txReceipt = await waitForTransactionReceipt(config, {
                        hash: hash,
                        chainId: sourceChainId,
                        confirmations: 1,
                    })
                    console.log(`Transaction ${i + 1} receipt:`, txReceipt)
                    receipts.push(txReceipt)

                    if (txReceipt.status === 'reverted') {
                        console.error(`Transaction ${i + 1} reverted:`, txReceipt)
                        throw new Error(`Transaction ${i + 1} failed (reverted).`)
                    }
                }
                // check if receipts were actually generated
                if (receipts.length === 0 || !receipts[receipts.length - 1]) {
                    console.error('Transaction sequence completed, but failed to get final receipt.')
                    throw new Error('Transaction sent but failed to get receipt.')
                }
                receipt = receipts[receipts.length - 1] // use the last receipt
            } catch (txError: any) {
                // re-throw the error with the current step context
                console.error(`Transaction failed during ${currentStep}:`, txError)
                throw txError
            }

            const txHash = receipt.transactionHash
            setTransactionHash(txHash)
            dispatch(paymentActions.setTransactionHash(txHash))
            console.log('External wallet final transaction hash:', txHash)

            setLoadingStep('Updating Payment Status')
            console.log('Updating payment status in backend for external wallet. Hash:', txHash)
            const payment = await chargesApi.createPayment({
                chargeId: chargeDetails.uuid,
                chainId: sourceChainId.toString(),
                hash: txHash,
                tokenAddress: selectedTokenData?.address || chargeDetails.tokenAddress,
            })
            console.log('Backend payment creation response:', payment)

            setPaymentDetails(payment)
            dispatch(paymentActions.setPaymentDetails(payment))

            setLoadingStep('Success')
            console.log('External wallet payment successful.')
            return { status: 'Success', charge: chargeDetails, payment, txHash, success: true }
        },
        [
            dispatch,
            selectedChainID,
            connectedWalletChain,
            switchChainAsync,
            xChainUnsignedTxs,
            unsignedTx,
            feeOptions,
            sendTransactionAsync,
            config,
            selectedTokenData,
        ]
    )

    // initiate and process payments
    const initiatePayment = useCallback(
        async (payload: InitiatePaymentPayload): Promise<InitiationResult> => {
            setLoadingStep('Idle')
            setError(null)
            setTransactionHash(null)
            setPaymentDetails(null)

            let determinedChargeDetails: TRequestChargeResponse | null = null
            let chargeCreated = false

            try {
                // 1. determine Charge Details
                const { chargeDetails, chargeCreated: created } = await determineChargeDetails(payload)
                determinedChargeDetails = chargeDetails
                chargeCreated = created
                console.log('Proceeding with charge details:', determinedChargeDetails.uuid)

                // 2. handle charge state
                if (chargeCreated && (payload.isPintaReq || payload.isAddMoneyFlow || !isPeanutWallet)) {
                    console.log(
                        `Charge created. Transitioning to Confirm view for: ${
                            payload.isPintaReq
                                ? 'Pinta Request'
                                : payload.isAddMoneyFlow
                                  ? 'Add Money Flow'
                                  : 'External Wallet'
                        }.`
                    )
                    setLoadingStep('Charge Created')
                    return { status: 'Charge Created', charge: determinedChargeDetails, success: false }
                }

                // 3. execute payment based on wallet type
                if (payload.isAddMoneyFlow) {
                    if (!wagmiAddress) {
                        console.error('Add Money flow requires an external wallet (WAGMI) to be connected.')
                        throw new Error('External wallet not connected for Add Money flow.')
                    }
                    console.log('Executing External Wallet transaction for Add Money flow.')
                    // Ensure charge details are passed, even if just created.
                    if (!determinedChargeDetails)
                        throw new Error('Charge details missing for Add Money external payment.')
                    return await handleExternalWalletPayment(determinedChargeDetails)
                } else if (isPeanutWallet && peanutWalletAddress) {
                    console.log(
                        `Executing Peanut Wallet transaction (chargeCreated: ${chargeCreated}, isPintaReq: ${payload.isPintaReq})`
                    )
                    return await handlePeanutWalletPayment(determinedChargeDetails)
                } else if (!isPeanutWallet) {
                    console.log('Handling payment for External Wallet (non-AddMoney, called from Confirm view).')
                    if (!determinedChargeDetails) throw new Error('Charge details missing for External Wallet payment.')
                    return await handleExternalWalletPayment(determinedChargeDetails)
                } else {
                    console.error('Invalid payment state: Could not determine wallet type or required action.')
                    throw new Error('Invalid payment state: Could not determine wallet type or required action.')
                }
            } catch (err) {
                // Ensure chargeId is removed from URL if error occurs after creation attempt
                if (chargeCreated && determinedChargeDetails) {
                    console.log('Error occurred after charge creation, removing chargeId from URL.')
                    const currentUrl = new URL(window.location.href)
                    if (currentUrl.searchParams.get('chargeId') === determinedChargeDetails.uuid) {
                        const newUrl = new URL(window.location.href)
                        newUrl.searchParams.delete('chargeId')
                        window.history.replaceState(null, '', newUrl.toString())
                        console.log('URL updated, chargeId removed.')
                    }
                }
                // handleError already logs the error and sets state
                return handleError(err, loadingStep)
            }
        },
        [
            determineChargeDetails,
            handlePeanutWalletPayment,
            handleExternalWalletPayment,
            isPeanutWallet,
            peanutWalletAddress,
            wagmiAddress,
            handleError,
            setLoadingStep,
            setError,
            setTransactionHash,
            setPaymentDetails,
            loadingStep,
        ]
    )

    const cancelOperation = useCallback(() => {
        setError('Please confirm the request in your wallet.')
        setLoadingStep('Error')
    }, [setError, setLoadingStep])

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
        slippagePercentage,
        estimatedFromValue,
        xChainUnsignedTxs,
        estimatedGasCost,
        unsignedTx,
        isCalculatingFees,
        isFeeEstimationError,
        isEstimatingGas,
        isXChain,
        diffTokens,
        cancelOperation,
        xChainRoute,
    }
}
