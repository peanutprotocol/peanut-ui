'use client'

import { Button } from '@/components/0_Bruddle'
import AddressLink from '@/components/Global/AddressLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import FlowHeader from '@/components/Global/FlowHeader'
import Icon from '@/components/Global/Icon'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import TokenSelector from '@/components/Global/TokenSelector/TokenSelector'
import BeerInput from '@/components/PintaReqPay/BeerInput'
import PintaReqViewWrapper from '@/components/PintaReqPay/PintaReqViewWrapper'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PINTA_WALLET_CHAIN,
    PINTA_WALLET_TOKEN_DECIMALS,
    PINTA_WALLET_TOKEN_SYMBOL,
} from '@/constants'
import * as context from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { AccountType, WalletProviderType } from '@/interfaces'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { getReadableChainName } from '@/lib/validation/resolvers/chain-resolver'
import { useAppDispatch, usePaymentStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { walletActions } from '@/redux/slices/wallet-slice'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'
import { CreateChargeRequest } from '@/services/services.types'
import {
    ErrorHandler,
    fetchTokenPrice,
    formatAmount,
    getTokenDecimals,
    getTokenSymbol,
    isNativeCurrency,
    printableAddress,
} from '@/utils'
import { interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { useSearchParams } from 'next/navigation'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { PaymentInfoRow } from '../PaymentInfoRow'

export const PaymentForm = ({ recipient, amount, token, chain, isPintaReq }: ParsedURL & { isPintaReq?: boolean }) => {
    const dispatch = useAppDispatch()
    const { requestDetails, error, chargeDetails, beerQuantity } = usePaymentStore()
    const {
        signInModal,
        isPeanutWallet,
        selectedWallet,
        isExternalWallet,
        isWalletConnected,
        wallets,
        selectPeanutWallet,
    } = useWallet()
    const [initialSetupDone, setInitialSetupDone] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [inputTokenAmount, setInputTokenAmount] = useState<string>(
        chargeDetails?.tokenAmount || requestDetails?.tokenAmount || amount || ''
    )
    const [usdValue, setUsdValue] = useState<string>('')
    const [requestedTokenPrice, setRequestedTokenPrice] = useState<number | null>(null)
    const [_isFetchingTokenPrice, setIsFetchingTokenPrice] = useState<boolean>(false)

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
    } = useContext(context.tokenSelectorContext)
    const searchParams = useSearchParams()
    const requestId = searchParams.get('id')
    const isConnected = useMemo<boolean>(() => {
        return selectedWallet ? isWalletConnected(selectedWallet) : false
    }, [isWalletConnected, selectedWallet])

    const recipientChainId = useMemo<string>(() => {
        if (!requestDetails) return ''

        if (chargeDetails?.chainId) return chargeDetails.chainId
        if (requestDetails?.chainId) return requestDetails.chainId
        switch (recipient.recipientType) {
            case 'USERNAME':
                return PEANUT_WALLET_CHAIN.id.toString()
            case 'ENS':
            case 'ADDRESS':
                return selectedChainID
            default:
                throw new Error('Invalid recipient type')
        }
    }, [chargeDetails?.chainId, requestDetails?.chainId, recipient, selectedChainID])

    const recipientTokenAddress = useMemo<string>(() => {
        if (!requestDetails) return ''

        if (chargeDetails?.tokenAddress) return chargeDetails.tokenAddress
        if (requestDetails?.tokenAddress) return requestDetails.tokenAddress
        switch (recipient.recipientType) {
            case 'USERNAME':
                return PEANUT_WALLET_TOKEN
            case 'ENS':
            case 'ADDRESS':
                return selectedTokenAddress
            default:
                throw new Error('Invalid recipient type')
        }
    }, [chargeDetails?.tokenAddress, requestDetails?.tokenAddress, recipient, selectedTokenAddress])

    const recipientTokenSymbol = useMemo<string>(() => {
        if (!requestDetails) return ''

        if (chargeDetails?.tokenSymbol) return chargeDetails.tokenSymbol
        if (requestDetails?.tokenSymbol) return requestDetails.tokenSymbol
        switch (recipient.recipientType) {
            case 'USERNAME':
                return 'USDC'
            case 'ENS':
            case 'ADDRESS':
                let tokenSymbol = selectedTokenData?.symbol ?? getTokenSymbol(recipientTokenAddress, recipientChainId)
                if (!tokenSymbol) {
                    return 'USDC'
                }
                return tokenSymbol
            default:
                throw new Error('Invalid recipient type')
        }
    }, [
        chargeDetails?.tokenSymbol,
        requestDetails?.tokenSymbol,
        selectedTokenData?.symbol,
        recipient,
        recipientTokenAddress,
        recipientChainId,
    ])

    const recipientTokenDecimals = useMemo<number>(() => {
        if (!requestDetails) return 0

        if (chargeDetails?.tokenDecimals) return chargeDetails.tokenDecimals
        if (requestDetails?.tokenDecimals) return requestDetails.tokenDecimals
        switch (recipient.recipientType) {
            case 'USERNAME':
                return 6
            case 'ENS':
            case 'ADDRESS':
                if (selectedTokenData?.decimals !== undefined) {
                    return selectedTokenData.decimals
                }
                if (recipientTokenAddress) {
                    const decimals = getTokenDecimals(recipientTokenAddress, recipientChainId)
                    if (decimals !== undefined) {
                        return decimals
                    }
                }
                return 6
            default:
                return 6
        }
    }, [
        chargeDetails?.tokenDecimals,
        requestDetails?.tokenDecimals,
        recipient,
        selectedTokenData?.decimals,
        recipientTokenAddress,
        recipientChainId,
    ])

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
                    setRequestedTokenPrice(priceData.price)

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

    const handleCreateCharge = async () => {
        if (!isConnected) {
            signInModal.open()
            return
        }

        // for Pinta requests, check beer quantity
        if (isPintaReq) {
            if (beerQuantity === 0 || isSubmitting) return
        } else if (
            (!inputTokenAmount && inputDenomination === 'TOKEN') ||
            (!usdValue && inputDenomination === 'USD') ||
            isSubmitting
        ) {
            return
        }

        setIsSubmitting(true)
        dispatch(paymentActions.setError(null))

        try {
            // if request ID available in URL, validate it
            let validRequestId: string | undefined = undefined
            if (requestId) {
                try {
                    const request = await requestsApi.get(requestId)
                    validRequestId = request.uuid
                } catch (error) {
                    throw new Error('Invalid request ID')
                }
            } else if (!requestDetails) {
                // for Pinta requests, create request if not exists
                if (isPintaReq && recipient.resolvedAddress) {
                    const request = await requestsApi.create({
                        recipientAddress: recipient.resolvedAddress,
                        chainId: PINTA_WALLET_CHAIN.id.toString(),
                        tokenAddress: recipientTokenAddress,
                        tokenType: String(peanutInterfaces.EPeanutLinkType.erc20),
                        tokenSymbol: PINTA_WALLET_TOKEN_SYMBOL,
                        tokenDecimals: PINTA_WALLET_TOKEN_DECIMALS.toString(),
                    })
                    validRequestId = request.uuid
                } else {
                    throw new Error('Request details not found')
                }
            }

            // this token amount is what we will create the charge with
            // for Pinta requests, use beerQuantity
            let tokenAmountToUse: string
            if (isPintaReq) {
                // tokenAmountToUse = '0.00002' // todo: replace with beerQuantity after testing
                tokenAmountToUse = beerQuantity.toString()
            } else {
                if (token?.symbol.toLowerCase() === 'usdc') {
                    tokenAmountToUse = usdValue ?? inputTokenAmount
                } else if (!amount && !!token) {
                    // the receiver is requesting a specific token, so we need to
                    // calculate the amount based on the token price
                    const receiveTokenPrice = await fetchTokenPrice(token.address, chain?.chainId!)
                    const usdAmount =
                        inputDenomination === 'TOKEN'
                            ? parseFloat(inputTokenAmount) * selectedTokenPrice!
                            : parseFloat(inputTokenAmount)
                    tokenAmountToUse = (usdAmount / receiveTokenPrice!.price).toString()
                } else if (inputDenomination === 'TOKEN') {
                    tokenAmountToUse = inputTokenAmount
                } else {
                    // convert to token amount using token price, if input value is in USD
                    if (!selectedTokenPrice) {
                        throw new Error('Token price not available')
                    }
                    const usdAmount = parseFloat(inputTokenAmount)
                    const tokenAmount = usdAmount / selectedTokenPrice
                    tokenAmountToUse = tokenAmount.toString()
                }
            }

            const createChargeRequestPayload: CreateChargeRequest = {
                pricing_type: 'fixed_price',
                local_price: {
                    amount: tokenAmountToUse,
                    currency: 'USD',
                },
                baseUrl: window.location.origin,
                requestId: validRequestId || requestDetails!.uuid,
                requestProps: {
                    // for Pinta requests, Polygon chain ID
                    chainId: isPintaReq ? '137' : recipientChainId,
                    tokenAddress: recipientTokenAddress,
                    tokenType: isPintaReq
                        ? peanutInterfaces.EPeanutLinkType.erc20
                        : isNativeCurrency(recipientTokenAddress)
                          ? peanutInterfaces.EPeanutLinkType.native
                          : peanutInterfaces.EPeanutLinkType.erc20,
                    tokenSymbol: isPintaReq ? 'PNT' : recipientTokenSymbol,
                    tokenDecimals: isPintaReq ? 10 : recipientTokenDecimals,
                    recipientAddress: recipient.resolvedAddress,
                },
            }

            // create charge using existing request ID and resolved address
            const charge = await chargesApi.create(createChargeRequestPayload)

            // replace URL params - remove requestId and add chargeId
            const newUrl = new URL(window.location.href)
            newUrl.searchParams.delete('id') // reemove request ID
            newUrl.searchParams.set('chargeId', charge.data.id) // add charge ID
            window.history.replaceState(null, '', newUrl.toString())

            dispatch(paymentActions.setCreatedChargeDetails(charge))
            dispatch(paymentActions.setView('CONFIRM'))
        } catch (error) {
            console.error('Failed to create charge:', error)
            const errorString = ErrorHandler(error)
            dispatch(paymentActions.setError(errorString))
        } finally {
            setIsSubmitting(false)
        }
    }

    // check if all required fields are present
    const canCreateCharge = useMemo<boolean>(() => {
        return !!recipient && !!inputTokenAmount && !!selectedTokenAddress && !!selectedChainID
    }, [recipient, inputTokenAmount, selectedTokenAddress, selectedChainID])

    // Get button text based on state
    const getButtonText = () => {
        if (!isConnected) return 'Connect Wallet'
        if (isSubmitting) {
            return (
                <div className="flex items-center justify-center gap-2">
                    <span>Hang on...</span>
                </div>
            )
        }
        return 'Pay'
    }

    const resetTokenAndChain = useCallback(() => {
        if (isPeanutWallet) {
            setSelectedChainID(PEANUT_WALLET_CHAIN.id.toString())
            setSelectedTokenAddress(PEANUT_WALLET_TOKEN)
        } else {
            setSelectedChainID((requestDetails?.chainId || chain?.chainId) ?? '')
            setSelectedTokenAddress((requestDetails?.tokenAddress || token?.address) ?? '')
        }
    }, [requestDetails, isPeanutWallet])

    useEffect(() => {
        if (isPeanutWallet) resetTokenAndChain()
    }, [resetTokenAndChain, isPeanutWallet])

    const recipientLabel = useMemo(() => {
        if (!requestDetails) return ''

        if (requestDetails.recipientAccount.type === AccountType.PEANUT_WALLET) {
            return requestDetails.recipientAccount.user.username
        }

        return printableAddress(requestDetails.recipientAddress)
    }, [requestDetails])

    const renderRequestedPaymentDetails = () => {
        if (!requestDetails || !requestDetails.tokenAmount || !requestDetails.tokenSymbol) return null

        const tokenAmount = parseFloat(requestDetails.tokenAmount)
        const tokenUsdValue =
            requestedTokenPrice && tokenAmount > 0 ? formatAmount(tokenAmount * requestedTokenPrice) : ''

        const tokenSymbol = requestDetails.tokenSymbol || token?.symbol

        const displayAmount = tokenUsdValue
            ? `$${tokenUsdValue} ( ${formatAmount(tokenAmount)} ${tokenSymbol} )`
            : `${formatAmount(tokenAmount)} ${tokenSymbol}`

        return (
            <div className="mb-6 border border-dashed border-black p-4">
                <div className="text-sm font-semibold text-black">{recipientLabel} is requesting:</div>
                <div className="flex flex-col">
                    <PaymentInfoRow label="Amount" value={displayAmount} />
                    {requestDetails.chainId && (
                        <PaymentInfoRow label="Network" value={getReadableChainName(requestDetails.chainId)} />
                    )}
                    {requestDetails.reference && <PaymentInfoRow label="Message" value={requestDetails.reference} />}
                    {requestDetails.attachmentUrl && (
                        <PaymentInfoRow
                            label="Attachment"
                            value={
                                <a
                                    href={requestDetails.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-0.5 text-sm font-semibold hover:underline"
                                >
                                    <span>Download</span>
                                    <Icon name="download" className="h-4 fill-grey-1" />
                                </a>
                            }
                        />
                    )}
                </div>
                <div className="mt-4 text-xs text-grey-1">
                    You can choose to pay with any token on any network. The payment will be automatically converted to
                    the requested token.
                </div>
            </div>
        )
    }

    // check if this is a cross-chain request for Peanut Wallet
    const isPeanutWalletCrossChainRequest = useMemo(() => {
        if (!requestDetails || !isPeanutWallet) return false

        // check if requested chain and token match Peanut Wallet's supported chain/token
        return (
            requestDetails.chainId !== PEANUT_WALLET_CHAIN.id.toString() ||
            requestDetails.tokenAddress.toLowerCase() !== PEANUT_WALLET_TOKEN.toLowerCase()
        )
    }, [requestDetails, isPeanutWallet])

    useEffect(() => {
        if (!inputTokenAmount) return
        if (inputDenomination === 'TOKEN') {
            if (selectedTokenPrice) {
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

    // Initialize token selector
    useEffect(() => {
        if (!chargeDetails) {
            resetTokenAndChain()
        }
    }, [chargeDetails, resetTokenAndChain])

    // Init beer quantity
    useEffect(() => {
        if (!inputTokenAmount) return
        if (isPintaReq) {
            dispatch(paymentActions.setBeerQuantity(Number(inputTokenAmount)))
        }
    }, [isPintaReq, inputTokenAmount])

    // handle auto-selection of rewards wallet if token is PNT
    useEffect(() => {
        if (!wallets?.length) return

        if (token?.symbol === 'PNT') {
            const rewardsWallet = wallets.find((wallet) => wallet.walletProviderType === WalletProviderType.REWARDS)
            if (rewardsWallet) {
                dispatch(walletActions.setSelectedWalletId(rewardsWallet.id))
            }
        } else if (selectedWallet?.walletProviderType === WalletProviderType.REWARDS) {
            selectPeanutWallet()
        }
    }, [token?.symbol, wallets, selectedWallet?.walletProviderType, selectPeanutWallet])

    if (isPintaReq) {
        return (
            <div className="space-y-4">
                <FlowHeader hideWalletHeader={!isConnected} isPintaReq />
                <PintaReqViewWrapper view="INITIAL">
                    <BeerInput disabled={!!amount} />
                    <div className="space-y-2">
                        <Button
                            variant="purple"
                            onClick={handleCreateCharge}
                            disabled={beerQuantity === 0 || isSubmitting || isPeanutWalletCrossChainRequest}
                            loading={isSubmitting}
                            className="w-full"
                        >
                            {isSubmitting ? 'Creating charge...' : 'Confirm'}
                        </Button>
                        {error && <ErrorAlert description={error} />}
                    </div>
                </PintaReqViewWrapper>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <FlowHeader hideWalletHeader={!isConnected} isPintaReq={token?.symbol === 'PNT'} />
            {/* Show recipient from parsed data */}
            <div className="text-h6 font-bold">
                Sending to{' '}
                {recipient.recipientType === 'USERNAME' ? (
                    recipient.identifier
                ) : (
                    <AddressLink address={recipient?.identifier} />
                )}
            </div>
            <TokenAmountInput
                tokenValue={inputTokenAmount}
                setTokenValue={(value: string | undefined) => setInputTokenAmount(value || '')}
                className="w-full"
                disabled={!!requestDetails?.tokenAmount || !!chargeDetails?.tokenAmount}
            />
            {requestDetails?.recipientAccount.type !== AccountType.PEANUT_WALLET && renderRequestedPaymentDetails()}
            {isExternalWallet && (
                <div>
                    <div className="mb-2 text-sm font-medium">Choose your payment method:</div>
                    <TokenSelector onReset={resetTokenAndChain} showOnlySquidSupported />
                </div>
            )}
            {/* Show Peanut Wallet cross-chain warning */}
            {isPeanutWalletCrossChainRequest && (
                <ErrorAlert
                    label="Note"
                    description={
                        'Cross-chain payments are not supported with Peanut Wallet yet. Switch to an external wallet to pay this request.'
                    }
                />
            )}
            {!isPeanutWallet && !requestId && (
                <div className="mt-4 text-xs text-grey-1">
                    You can choose to pay with any token on any network. The payment will be automatically converted to
                    the requested token.
                </div>
            )}
            <div className="space-y-2">
                <Button
                    loading={isSubmitting}
                    shadowSize="4"
                    onClick={handleCreateCharge}
                    disabled={!canCreateCharge || isSubmitting || isPeanutWalletCrossChainRequest}
                    className="w-full"
                >
                    {getButtonText()}
                </Button>

                {error && <ErrorAlert label="Error" description={error} />}
            </div>
        </div>
    )
}
