'use client'
import { sortCrossChainDetails } from '@/components/Claim/Claim.utils'
import useClaimLink from '@/components/Claim/useClaimLink'
import { useCreateLink } from '@/components/Create/useCreateLink'
import { CrispButton } from '@/components/CrispChat'
import FeeDescription from '@/components/Global/FeeDescription'
import Icon from '@/components/Global/Icon'
import InfoRow from '@/components/Global/InfoRow'
import { GlobalKYCComponent } from '@/components/Global/KYCComponent'
import { GlobaLinkAccountComponent } from '@/components/Global/LinkAccountComponent'
import Loading from '@/components/Global/Loading'
import MoreInfo from '@/components/Global/MoreInfo'
import * as consts from '@/constants'
import * as context from '@/context'
import { useAuth } from '@/context/authContext'
import * as utils from '@/utils'
import { formatBankAccountDisplay } from '@/utils/format.utils'
import { getSquidTokenAddress } from '@/utils/token.utils'
import peanut, { getLatestContractVersion, getLinkDetails } from '@squirrel-labs/peanut-sdk'
import { useSteps } from 'chakra-ui-steps'
import Link from 'next/link'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'

import {
    CrossChainDetails,
    IOfframpConfirmScreenProps,
    LiquidationAddress,
    OfframpType,
    optimismChainId,
    PeanutAccount,
    usdcAddressOptimism,
} from '@/components/Offramp/Offramp.consts'
import { Button, Card } from '../0_Bruddle'
import { FAQComponent } from '../Cashout/Components/Faq.comp'
import FlowHeader from '../Global/FlowHeader'
import PromoCodeChecker from './PromoCodeChecker'
import * as Sentry from '@sentry/nextjs'

export const OfframpConfirmView = ({
    onNext, // available on all offramps
    onPrev, // available on all offramps
    initialKYCStep, // available on all offramps
    offrampForm, // available on all offramps
    setOfframpForm, // available on all offramps
    offrampType, // available on all offramps
    setTransactionHash, // available on all offramps

    usdValue, // available on cashouts
    tokenValue, // available on cashouts
    preparedCreateLinkWrapperResponse, // available on cashouts

    claimLinkData, // available on link claim offramps
    recipientType, // available on link claim offramps
    tokenPrice, // available on link claim offramps
    attachment, // available on link claim offramps
    estimatedPoints, // available on link claim offramps
    crossChainDetails, // available on link claim offramps
    appliedPromoCode,
    onPromoCodeApplied,
    estimatedGasCost,
}: IOfframpConfirmScreenProps) => {
    //////////////////////
    // state and context vars w/ shared functionality across all offramp types

    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const { claimLink, claimLinkXchain } = useClaimLink()
    const { fetchUser, user } = useAuth()

    const accountType = user?.accounts?.find(
        (account) =>
            account?.account_identifier?.replaceAll(/\s/g, '').toLowerCase() ===
            offrampForm.recipient?.replaceAll(/\s/g, '').toLowerCase()
    )?.account_type

    //////////////////////
    // state and context vars for cashout offramp
    const { selectedChainID, selectedTokenAddress, selectedTokenData } = useContext(context.tokenSelectorContext)
    const [showRefund, setShowRefund] = useState(false)
    const { createLinkWrapper } = useCreateLink()
    const [createdLink, setCreatedLink] = useState<string | undefined>(undefined)
    const [slippagePercentage, setSlippagePercentage] = useState<number | undefined>(undefined)
    const [isFetchingRoute, setIsFetchingRoute] = useState(false)
    //////////////////////
    // state and context vars for claim link offramp

    //////////////////////
    // functions w/ shared functionality across all offramp types
    const { setStep: setActiveStep, activeStep } = useSteps({
        initialStep: initialKYCStep,
    })

    const handleCompleteKYC = (message: string) => {
        if (message === 'account found') {
            setActiveStep(4)
        } else if (message === 'KYC completed') {
            setActiveStep(3)
        }
    }

    const handleCompleteLinkAccount = (message: string) => {
        if (message === 'success') {
            setActiveStep(4)
        }
    }

    const handlePromoCodeApplied = (code: string | null) => {
        onPromoCodeApplied(code)
    }
    //////////////////////
    // functions for cashout offramps
    // TODO: they need to be refactored to a separate file
    // TODO: this function is a clusterfuck
    const fetchNecessaryDetails = useCallback(async () => {
        // check if user and token information is available
        if (!user || !selectedChainID || !selectedTokenAddress) {
            throw new Error('Missing user or token information')
        }

        // determine token type: 0 for native currency, 1 for others
        const tokenType = utils.isNativeCurrency(selectedTokenAddress) ? 0 : 1
        const contractVersion = await getLatestContractVersion({
            chainId: selectedChainID,
            type: 'normal',
            experimental: false,
        })

        // fetch cross-chain details based on chain ID, token type, and contract version
        const crossChainDetails = await getCrossChainDetails({
            chainId: selectedChainID,
            tokenType,
            contractVersion,
        })

        // Find the user's Peanut account that matches the offramp form recipient
        const peanutAccount = user.accounts.find(
            (account) =>
                account.account_identifier?.replaceAll(/\s/g, '').toLowerCase() ===
                offrampForm?.recipient?.replaceAll(/\s/g, '').toLowerCase()
        )
        const bridgeCustomerId = user?.user?.bridge_customer_id
        const bridgeExternalAccountId = peanutAccount?.bridge_account_id

        // ensure all necessary account information is available
        if (!peanutAccount || !bridgeCustomerId || !bridgeExternalAccountId) {
            throw new Error('Missing account information')
        }

        // fetch all liquidation addresses for the user
        const allLiquidationAddresses = await utils.getLiquidationAddresses(bridgeCustomerId)

        return {
            crossChainDetails,
            peanutAccount,
            bridgeCustomerId,
            bridgeExternalAccountId,
            allLiquidationAddresses,
        }
    }, [user, selectedChainID, selectedTokenAddress, offrampForm])

    // For cashout offramps
    const handleCashoutConfirm = async () => {
        setLoadingState('Loading')
        setErrorState({ showError: false, errorMessage: '' })

        try {
            if (!preparedCreateLinkWrapperResponse) return

            // Fetch all necessary details before creating the link
            const {
                crossChainDetails,
                peanutAccount,
                bridgeCustomerId,
                bridgeExternalAccountId,
                allLiquidationAddresses,
            } = await fetchNecessaryDetails()

            console.log('peanutAccount', peanutAccount)

            // Process link details and determine if cross-chain transfer is needed
            // TODO: type safety
            const { tokenName, chainName, xchainNeeded, liquidationAddress } = await processLinkDetails(
                preparedCreateLinkWrapperResponse.linkDetails,
                crossChainDetails as CrossChainDetails[],
                allLiquidationAddresses,
                bridgeCustomerId,
                bridgeExternalAccountId,
                peanutAccount.account_type
            )

            if (!tokenName || !chainName) {
                throw new Error('Unable to determine token or chain information')
            }

            // get chainId and tokenAddress (default to optimism)
            const chainId = utils.getChainIdFromBridgeChainName(chainName) ?? ''
            const tokenAddress = utils.getTokenAddressFromBridgeTokenName(chainId ?? '10', tokenName) ?? ''

            // Now that we have all the necessary information, create the link
            const link = await createLinkWrapper(preparedCreateLinkWrapperResponse)
            setCreatedLink(link)
            console.log(`created claimlink: ${link}`)

            // Save link temporarily in localStorage with TEMP tag
            const tempKey = `TEMP_CASHOUT_LINK_${Date.now()}`
            localStorage.setItem(
                tempKey,
                JSON.stringify({
                    link,
                    createdAt: Date.now(),
                })
            )
            console.log(`Temporarily saved link in localStorage with key: ${tempKey}`)

            const claimLinkData = await getLinkDetails({ link: link })

            const srcChainId = claimLinkData.chainId
            const destChainId = chainId
            const isSameChain = srcChainId === destChainId
            const { sourceTxHash, destinationTxHash } = await claimAndProcessLink(
                xchainNeeded,
                liquidationAddress.address,
                claimLinkData,
                chainId,
                tokenAddress,
                isSameChain
            )

            console.log(
                `finalized claimAndProcessLink, sourceTxHash: ${sourceTxHash}, destinationTxHash: ${destinationTxHash}`
            )

            localStorage.removeItem(tempKey)
            console.log(`Removed temporary link from localStorage: ${tempKey}`)

            await saveAndSubmitCashoutLink(
                claimLinkData,
                destinationTxHash,
                liquidationAddress,
                bridgeCustomerId,
                bridgeExternalAccountId,
                chainId,
                tokenName,
                peanutAccount
            )

            setTransactionHash(destinationTxHash)
            console.log('Transaction hash:', destinationTxHash)

            onNext()
        } catch (error) {
            handleError(error)
        } finally {
            setLoadingState('Idle')
        }
    }

    const processLinkDetails = async (
        claimLinkData: any, // TODO: fix type
        crossChainDetails: CrossChainDetails[],
        allLiquidationAddresses: LiquidationAddress[],
        bridgeCustomerId: string,
        bridgeExternalAccountId: string,
        accountType: string
    ) => {
        // get token and chain names from claim link data
        let tokenName = utils.getBridgeTokenName(claimLinkData.chainId, claimLinkData.tokenAddress)
        let chainName = utils.getBridgeChainName(claimLinkData.chainId)
        let xchainNeeded = false

        // if token and chain names are not available, set up cross-chain transfer to optimism usdc
        if (!tokenName || !chainName) {
            xchainNeeded = true
            const result = await handleCrossChainScenario(claimLinkData)
            if (!result) {
                throw new Error('Failed to setup cross-chain transfer')
            }
            tokenName = result.tokenName
            chainName = result.chainName
        }

        // find or create a liquidation address for the user
        let liquidationAddress = allLiquidationAddresses.find(
            (address) =>
                address.chain === chainName &&
                address.currency === tokenName &&
                address.external_account_id === bridgeExternalAccountId
        )

        if (!liquidationAddress) {
            liquidationAddress = await utils.createLiquidationAddress(
                bridgeCustomerId,
                chainName as string,
                tokenName as string,
                bridgeExternalAccountId,
                accountType === 'iban' ? 'sepa' : 'ach',
                accountType === 'iban' ? 'eur' : 'usd'
            )
        }

        return { tokenName, chainName, xchainNeeded, liquidationAddress }
    }

    const getRouteDetails = async () => {
        setIsFetchingRoute(true)
        try {
            // fetch route details using link details to calculate slippage
            const { route } = await utils.fetchRouteRaw(
                preparedCreateLinkWrapperResponse?.linkDetails.tokenAddress ?? '',
                preparedCreateLinkWrapperResponse?.linkDetails.chainId ?? '',
                usdcAddressOptimism,
                optimismChainId,
                preparedCreateLinkWrapperResponse?.linkDetails.tokenDecimals ?? 0,
                String(preparedCreateLinkWrapperResponse?.linkDetails.tokenAmount ?? '0')
            )

            // get slippage percentage from route details
            if (route.params && route.params.slippage) {
                setSlippagePercentage(route.params.slippage)
            } else {
                // default to 1% slippage if not available
                setSlippagePercentage(1)
            }
        } catch (error) {
            console.error('Error fetching route details:', error)
        } finally {
            setIsFetchingRoute(false)
        }
    }

    useEffect(() => {
        getRouteDetails()
    }, [])

    const calculatedSlippage = useMemo(() => {
        if (!selectedTokenData?.price || !slippagePercentage) return null

        // percentage of maximum slippage to use as expected slippage (10%)
        const EXPECTED_SLIPPAGE_MULTIPLIER = 0.1

        // calculate the slippage based on the token price and the slippage percentage
        const slippage = ((slippagePercentage / 100) * selectedTokenData?.price * Number(tokenValue)).toFixed(2) || 0

        return {
            expected: Number(slippage) * EXPECTED_SLIPPAGE_MULTIPLIER,
            max: Number(slippage),
        }
    }, [slippagePercentage, tokenPrice, tokenValue])

    // TODO: fix type
    const handleCrossChainScenario = async (
        linkDetails: any
    ): Promise<{ tokenName: string | undefined; chainName: string | undefined } | false> => {
        try {
            const route = await utils.fetchRouteRaw(
                linkDetails.tokenAddress,
                linkDetails.chainId,
                usdcAddressOptimism,
                optimismChainId,
                linkDetails.tokenDecimals,
                linkDetails.tokenAmount,
                linkDetails.senderAddress
            )

            if (!route) {
                console.error('No route found for token:', {
                    fromToken: linkDetails.tokenAddress,
                    fromChain: linkDetails.chainId,
                    toToken: usdcAddressOptimism,
                    toChain: optimismChainId,
                })
                setErrorState({
                    showError: true,
                    errorMessage: 'This token does not support cross-chain transfers. Please try a different token.',
                })
                return false
            }

            return {
                tokenName: utils.getBridgeTokenName(optimismChainId, usdcAddressOptimism),
                chainName: utils.getBridgeChainName(optimismChainId),
            }
        } catch (error) {
            console.error('Error in cross-chain scenario:', error)
            let errorMessage = 'Failed to setup cross-chain transfer'

            // Check for specific error messages
            if (error instanceof Error) {
                const errorBody = error.message.includes('{"message":') ? JSON.parse(error.message) : null

                if (errorBody?.message === 'Unable to fetch token data') {
                    errorMessage =
                        'This token is not supported for cross-chain transfers. Please try a different token.'
                } else if (errorBody?.message) {
                    errorMessage = errorBody.message
                }
            }

            setErrorState({
                showError: true,
                errorMessage,
            })
            Sentry.captureException(error)
            return false
        }
    }

    const claimAndProcessLink = async (
        xchainNeeded: boolean,
        address: string,
        claimLinkData: any, // TODO: fix type
        chainId: string,
        tokenAddress: string,
        isSameChain?: boolean // e.g. for opt ETH -> opt USDC
    ): Promise<{ sourceTxHash: string; destinationTxHash: string }> => {
        if (xchainNeeded) {
            // In a cross-chain scenario, the src tx hash is different than the dest tx hash. It takes a while for us
            // to fetch it, since the destination chain tx is not available immediately. We query squid in intervals until we get it or we bail.
            // exception is a same chain swap, where the tx is atomic and available immediately
            const sourceTxHash = await claimLinkXchain({
                address,
                link: claimLinkData.link,
                destinationChainId: chainId,
                destinationToken: tokenAddress,
            })

            if (isSameChain) {
                return {
                    sourceTxHash,
                    destinationTxHash: sourceTxHash,
                }
            }

            // @dev this code has been removed, we go straight to success screen. Cross-chain status is checked in backend
            // todo: revist, not a good idea to wait for the tx to be available, look for better soln
            // const maxAttempts = 15
            // let attempts = 0

            // while (attempts < maxAttempts) {
            // try {
            //     const status = await checkTransactionStatus(sourceTxHash)
            //     if (status.squidTransactionStatus === 'success') {
            //         return {
            //             sourceTxHash,
            //             destinationTxHash: status.toChain.transactionId,
            //         }
            //     }
            // } catch (error) {
            //     console.warn('Error checking transaction status:', error)
            // }

            // attempts++
            // if (attempts < maxAttempts) {
            //     await new Promise((resolve) => setTimeout(resolve, 2000))
            // }
            // }

            // console.warn('Transaction status check timed out. Using sourceTxHash as destinationTxHash.')

            //
            // try {
            //     const status = await checkTransactionStatus(sourceTxHash)
            //     if (status.squidTransactionStatus === 'success') {
            //         return {
            //             sourceTxHash,
            //             destinationTxHash: status.toChain.transactionId,
            //         }
            //     }
            // } catch (error) {
            //     console.warn('Error checking transaction status:', error)
            // }

            // fallback: use source hash if status check fails or transaction not yet successful
            return {
                sourceTxHash,
                destinationTxHash: sourceTxHash,
            }
        } else {
            // same chain and same token scenario
            const sourceTxHash = await claimLink({
                address,
                link: claimLinkData.link,
            })
            return { sourceTxHash, destinationTxHash: sourceTxHash }
        }
    }

    const saveAndSubmitCashoutLink = async (
        claimLinkData: any,
        hash: string,
        liquidationAddress: LiquidationAddress,
        bridgeCustomerId: string,
        bridgeExternalAccountId: string,
        chainId: string,
        tokenName: string,
        peanutAccount: PeanutAccount
    ) => {
        try {
            setLoadingState('Submitting Offramp')
            // save to localStorage first
            utils.saveOfframpLinkToLocalstorage({
                data: {
                    ...claimLinkData,
                    depositDate: new Date(),
                    USDTokenPrice: parseFloat(usdValue ?? ''),
                    points: 0,
                    txHash: hash,
                    message: undefined,
                    attachmentUrl: undefined,
                    liquidationAddress: liquidationAddress.address,
                    recipientType: 'bank',
                    accountNumber: offrampForm.recipient,
                    bridgeCustomerId: bridgeCustomerId,
                    bridgeExternalAccountId: bridgeExternalAccountId,
                    peanutCustomerId: user?.user?.userId,
                    peanutExternalAccountId: peanutAccount.account_id,
                },
            })

            const response = await utils.submitCashoutLink({
                link: claimLinkData.link,
                bridgeCustomerId: bridgeCustomerId,
                liquidationAddressId: liquidationAddress.id,
                cashoutTransactionHash: hash,
                externalAccountId: peanutAccount.account_id,
                chainId: chainId,
                tokenName: tokenName,
                promoCode: appliedPromoCode || '',
                trackParam: appliedPromoCode || '',
            })

            if (!response.ok) {
                console.error('Failed to submit cashout link:', await response.json())
                throw new Error('Failed to submit cashout link')
            }
            setLoadingState('Idle')
        } catch (error) {
            setLoadingState('Idle')
            console.error('Error in saveAndSubmitCashoutLink:', error)
        }
    }

    const handleError = (error: unknown) => {
        const errorString = utils.ErrorHandler(error)
        console.error('Error in handleCashoutConfirm:', error)
        setErrorState({
            showError: true,
            errorMessage:
                error instanceof Error
                    ? errorString
                    : "We've encountered an error. Your funds are SAFU, please reach out to support",
        })
        setShowRefund(true)
    }

    const getCrossChainDetails = async ({
        chainId,
        tokenType,
        contractVersion,
    }: {
        chainId: string
        tokenType: number
        contractVersion: string
    }) => {
        try {
            const crossChainDetails = await peanut.getXChainOptionsForLink({
                isTestnet: utils.isTestnetChain(chainId.toString()),
                sourceChainId: chainId.toString(),
                tokenType: tokenType,
            })

            const contractVersionCheck = peanut.compareVersions('v4.2', contractVersion, 'v') // v4.2 is the minimum version required for cross chain
            if (crossChainDetails.length > 0 && contractVersionCheck) {
                const xchainDetails = sortCrossChainDetails(
                    crossChainDetails.filter((chain: any) => chain.chainId != '1'),
                    consts.supportedPeanutChains,
                    chainId
                )
                return xchainDetails
            } else {
                return undefined
            }
        } catch (error) {
            console.log('error fetching cross chain details: ' + error)
            Sentry.captureException(error)
            return undefined
        }
    }

    //////////////////////
    // functions for claim link offramps (not self-cashout)
    // TODO: they need to be refactored to a separate file
    const handleSubmitTransfer = async () => {
        if (claimLinkData && tokenPrice && estimatedPoints && attachment && recipientType) {
            try {
                setLoadingState('Submitting Offramp')

                let tokenName = utils.getBridgeTokenName(claimLinkData.chainId, claimLinkData.tokenAddress)
                let chainName = utils.getBridgeChainName(claimLinkData.chainId)
                let xchainNeeded = false

                // If token isn't directly supported by bridge, route through USDC Optimism
                if (!tokenName || !chainName) {
                    xchainNeeded = true
                    console.log('Debug - Routing through USDC Optimism')

                    const fromToken = getSquidTokenAddress(claimLinkData.tokenAddress)

                    let route
                    try {
                        route = await utils.fetchRouteRaw(
                            fromToken,
                            claimLinkData.chainId.toString(),
                            usdcAddressOptimism,
                            optimismChainId,
                            claimLinkData.tokenDecimals,
                            claimLinkData.tokenAmount,
                            claimLinkData.senderAddress
                        )
                    } catch (error) {
                        console.error('Error fetching route:', error)
                        setErrorState({
                            showError: true,
                            errorMessage: 'offramp unavailable',
                        })
                        Sentry.captureException(error)
                        return
                    }

                    if (!route) {
                        setErrorState({
                            showError: true,
                            errorMessage: 'offramp unavailable',
                        })
                        return
                    }

                    tokenName = utils.getBridgeTokenName(optimismChainId, usdcAddressOptimism)
                    chainName = utils.getBridgeChainName(optimismChainId)
                }

                if (!user || !chainName || !tokenName) return

                const peanutAccount = user.accounts.find(
                    (account) =>
                        account.account_identifier?.replaceAll(/\s/g, '').toLowerCase() ===
                        offrampForm?.recipient?.replaceAll(/\s/g, '').toLowerCase()
                )
                const bridgeCustomerId = user?.user?.bridge_customer_id
                const bridgeExternalAccountId = peanutAccount?.bridge_account_id

                if (!peanutAccount || !bridgeCustomerId || !bridgeExternalAccountId) {
                    console.log('peanut account, bridgeCustomerId or bridgeExternalAccountId not found. ', {
                        peanutAccount,
                        bridgeCustomerId,
                        bridgeExternalAccountId,
                    })
                    return
                }

                const allLiquidationAddresses = await utils.getLiquidationAddresses(bridgeCustomerId)

                let liquidationAddress = allLiquidationAddresses.find(
                    (address) =>
                        address.chain === chainName &&
                        address.currency === tokenName &&
                        address.external_account_id === bridgeExternalAccountId
                )
                if (!liquidationAddress) {
                    liquidationAddress = await utils.createLiquidationAddress(
                        bridgeCustomerId,
                        chainName,
                        tokenName,
                        bridgeExternalAccountId,
                        recipientType === 'iban' ? 'sepa' : 'ach',
                        recipientType === 'iban' ? 'eur' : 'usd'
                    )
                }
                const chainId = utils.getChainIdFromBridgeChainName(chainName) ?? ''
                const tokenAddress = utils.getTokenAddressFromBridgeTokenName(chainId ?? '10', tokenName) ?? ''

                let hash
                if (xchainNeeded) {
                    hash = await claimLinkXchain({
                        address: liquidationAddress.address,
                        link: claimLinkData.link,
                        destinationChainId: chainId,
                        destinationToken: tokenAddress,
                    })
                } else {
                    hash = await claimLink({
                        address: liquidationAddress.address,
                        link: claimLinkData.link,
                    })
                }

                if (hash) {
                    utils.saveOfframpLinkToLocalstorage({
                        data: {
                            ...claimLinkData,
                            depositDate: new Date(),
                            USDTokenPrice: tokenPrice,
                            points: estimatedPoints,
                            txHash: hash,
                            message: attachment.message ? attachment.message : undefined,
                            attachmentUrl: attachment.attachmentUrl ? attachment.attachmentUrl : undefined,
                            liquidationAddress: liquidationAddress.address,
                            recipientType: recipientType,
                            accountNumber: offrampForm.recipient,
                            bridgeCustomerId: bridgeCustomerId,
                            bridgeExternalAccountId: bridgeExternalAccountId,
                            peanutCustomerId: user?.user?.userId,
                            peanutExternalAccountId: peanutAccount.account_id,
                        },
                    })
                    setTransactionHash(hash)
                    setLoadingState('Idle')
                    onNext()
                }
            } catch (error) {
                console.error('Error during the submission process:', error)
                setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again later' })
                Sentry.captureException(error)
            } finally {
                setLoadingState('Idle')
            }
        }
    }

    const calculateBankingFee = useCallback(
        (accountType: string) => {
            if (!!appliedPromoCode) return 0

            const amount = parseFloat(usdValue ?? '0')

            // peanut fee is 0.25% of the amount
            const PEANUT_FEE_PERCENTAGE = 0.0025
            const peanutFee = amount * PEANUT_FEE_PERCENTAGE
            const bankingFee = (accountType === 'iban' ? 1 : 0.5) + peanutFee

            return bankingFee
        },
        [appliedPromoCode, usdValue]
    )

    const calculateEstimatedFee = (
        estimatedGasCost: string | undefined,
        hasPromoCode: boolean,
        accountType: string | undefined,
        isCrossChainTx: boolean
    ): number => {
        // estimated network cost for the transaction
        const estimatedNetworkFee = parseFloat(estimatedGasCost ?? '0')
        if (hasPromoCode) return estimatedNetworkFee

        // additional fees based on bank account type and cross-chain transfer
        const bankingFee = calculateBankingFee(accountType ?? 'iban')
        const crossChainFee = isCrossChainTx ? (calculatedSlippage?.expected ?? 0) : 0

        // total estimated fee
        return estimatedNetworkFee + bankingFee + crossChainFee
    }

    // check if fee exceeds withdraw amount and update error state
    useEffect(() => {
        // calculate total fees
        const totalFees = calculateEstimatedFee(estimatedGasCost, !!appliedPromoCode, accountType, !!crossChainDetails)

        // determine the amount based on offramp type
        const amount =
            offrampType == OfframpType.CASHOUT
                ? parseFloat(usdValue ?? '0')
                : tokenPrice && claimLinkData
                  ? tokenPrice * parseFloat(claimLinkData.tokenAmount)
                  : 0

        // update error state if fees exceed the amount
        if (!isNaN(amount) && !isNaN(totalFees) && amount <= totalFees) {
            setErrorState({
                showError: true,
                errorMessage: 'Transaction fees exceed the withdrawal amount. Please try a larger amount.',
            })
        } else {
            setErrorState({
                showError: false,
                errorMessage: '',
            })
        }
    }, [
        estimatedGasCost,
        usdValue,
        appliedPromoCode,
        accountType,
        crossChainDetails,
        offrampType,
        tokenPrice,
        claimLinkData,
    ])

    return (
        <div>
            <FlowHeader
                onPrev={() => {
                    onPrev()
                    setActiveStep(0)
                    setErrorState({ showError: false, errorMessage: '' })
                    setOfframpForm({ email: '', name: '', recipient: '', password: '' })
                    fetchUser()
                }}
                disableBackBtn={isLoading}
                disableWalletHeader
            />

            <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header>
                    <Card.Title>Confirm your details</Card.Title>
                    <Card.Description>
                        {offrampType == OfframpType.CASHOUT && (
                            <div className="flex flex-col items-center justify-center gap-2">
                                <label className="text-start text-h8 font-light">
                                    Cash out your crypto to your bank account. From any token, any chain, directly to
                                    your bank account.
                                </label>
                                <FAQComponent />
                            </div>
                        )}
                        {offrampType == OfframpType.CLAIM && (
                            <label className="text-start text-h8 font-light">
                                Cash out this link's crypto to your bank account. Works best with popular stablecoins
                                and other commonly traded tokens.
                            </label>
                        )}
                    </Card.Description>
                </Card.Header>

                <Card.Content className="col gap-4 p-6">
                    {activeStep < 3 ? (
                        <GlobalKYCComponent
                            intialStep={initialKYCStep}
                            offrampForm={offrampForm}
                            setOfframpForm={setOfframpForm}
                            onCompleted={(message) => {
                                handleCompleteKYC(message)
                            }}
                        />
                    ) : activeStep === 3 ? (
                        <GlobaLinkAccountComponent
                            accountNumber={offrampForm?.recipient}
                            onCompleted={() => {
                                handleCompleteLinkAccount('success')
                            }}
                        />
                    ) : (
                        <div className="my-2 flex w-full flex-col items-center justify-center gap-2">
                            <label className="self-start text-h8 font-light">Please confirm all details:</label>
                            <div className="flex w-full flex-col items-center justify-center gap-3">
                                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                                        <Icon name={'profile'} className="h-4 fill-gray-1" />
                                        <label className="font-bold">Name</label>
                                    </div>
                                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                        {user?.user?.full_name}
                                    </span>
                                </div>

                                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                                        <Icon name={'email'} className="h-4 fill-gray-1" />
                                        <label className="font-bold">Email</label>
                                    </div>
                                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                        {user?.user?.email}
                                    </span>
                                </div>

                                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                                    <div className="flex w-max flex-row items-center justify-center gap-1">
                                        <Icon name={'bank'} className="h-4 fill-gray-1" />
                                        <label className="font-bold">Bank account</label>
                                    </div>
                                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                        {formatBankAccountDisplay(offrampForm.recipient)}
                                    </span>
                                </div>

                                {offrampType == OfframpType.CLAIM && (
                                    <div className="flex w-full flex-row items-center px-2 text-h8 text-gray-1">
                                        <div className="flex w-1/3 flex-row items-center gap-1">
                                            <Icon name={'forward'} className="h-4 fill-gray-1" />
                                            <label className="font-bold">Route</label>
                                        </div>
                                        <div className="relative flex flex-1 items-center justify-end gap-1 text-sm font-normal">
                                            <div className="flex items-center gap-1">
                                                {
                                                    consts.supportedPeanutChains.find(
                                                        (chain) => chain.chainId === claimLinkData?.chainId
                                                    )?.name
                                                }{' '}
                                                <Icon name={'arrow-next'} className="h-4 fill-gray-1" /> Offramp{' '}
                                                <Icon name={'arrow-next'} className="h-4 fill-gray-1" />{' '}
                                                {recipientType?.toUpperCase()}{' '}
                                                <MoreInfo
                                                    text={`Wait, crypto can be converted to real money??? How cool!`}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex w-full flex-col items-center justify-center">
                                    {/* note: the Expected receive amount is the amount that the user will receive after banking fees and slippage is deduducted, users need to pay for gas separately, and gas is not included in the expected receive amount */}
                                    <InfoRow
                                        iconName="money-in"
                                        label="Expected receive"
                                        value={(() => {
                                            // calculate banking fee based on promo code and account type
                                            const bankingFee = calculateBankingFee(accountType ?? 'iban')

                                            const totalFees = bankingFee + (calculatedSlippage?.expected ?? 0)

                                            // determine the amount based on offramp type
                                            const amount =
                                                offrampType == OfframpType.CASHOUT
                                                    ? parseFloat(usdValue ?? '0')
                                                    : tokenPrice && claimLinkData
                                                      ? tokenPrice * parseFloat(claimLinkData.tokenAmount)
                                                      : 0

                                            // return 0 if fees exceed amount, otherwise calculate expected receive
                                            return amount <= totalFees
                                                ? '$0'
                                                : `$${utils.formatTokenAmount(amount - totalFees)}` || '$0'
                                        })()}
                                        moreInfoText="Expected amount you will receive in your bank account. You'll receive funds in your local currency."
                                    />

                                    <FeeDescription
                                        estimatedFee={calculateEstimatedFee(
                                            estimatedGasCost,
                                            !!appliedPromoCode,
                                            accountType,
                                            !!crossChainDetails
                                        ).toString()}
                                        networkFee={estimatedGasCost ?? '0'}
                                        minReceive={(() => {
                                            const amount = parseFloat(usdValue ?? '0')

                                            // calculate banking fee based on promo code and account type
                                            const bankingFee = calculateBankingFee(accountType ?? 'iban')

                                            const totalFees = bankingFee + (calculatedSlippage?.expected ?? 0)

                                            // return 0 if fees exceed amount, otherwise calculate minimum receive
                                            return amount <= totalFees
                                                ? '0'
                                                : utils.formatTokenAmount(amount - totalFees)
                                        })()}
                                        slippageRange={{
                                            max: utils.formatAmount(calculatedSlippage?.max || '0').toString() ?? '0',
                                            min:
                                                utils.formatAmount(calculatedSlippage?.expected || '0').toString() ??
                                                '0',
                                        }}
                                        accountType={accountType}
                                        accountTypeFee={(() => {
                                            // calculate banking fee based on promo code and account type
                                            const bankingFee = calculateBankingFee(accountType ?? 'iban')

                                            return utils.formatAmount(bankingFee)
                                        })()}
                                        isPromoApplied={!!appliedPromoCode}
                                        loading={isFetchingRoute}
                                    />
                                </div>

                                <PromoCodeChecker
                                    onPromoCodeApplied={handlePromoCodeApplied}
                                    appliedPromoCode={appliedPromoCode!}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex w-full flex-col items-stretch justify-center gap-2">
                        {activeStep > 3 && (
                            <Button
                                onClick={() => {
                                    switch (offrampType) {
                                        case OfframpType.CASHOUT: {
                                            handleCashoutConfirm()
                                            break
                                        }
                                        case OfframpType.CLAIM: {
                                            handleSubmitTransfer()
                                            break
                                        }
                                    }
                                }}
                                className="w-full"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <div className="flex w-full flex-row items-center justify-center gap-2">
                                        <Loading /> {loadingState}
                                    </div>
                                ) : (
                                    'Cashout'
                                )}
                            </Button>
                        )}

                        {errorState.showError && (
                            <div className="text-start">
                                {errorState.errorMessage === 'offramp unavailable' ? (
                                    <label className="text-h8 font-normal text-red">
                                        This token cannot be cashed out directly.{' '}
                                        <CrispButton className="text-blue-600 underline">Chat with support</CrispButton>
                                    </label>
                                ) : (
                                    <label className="text-start text-h8 font-normal text-red">
                                        {errorState.errorMessage}
                                    </label>
                                )}
                            </div>
                        )}
                        {showRefund && createdLink && (
                            <Link href={createdLink ?? ''} className=" text-h8 font-normal ">
                                <Icon name="warning" className="-mt-0.5" /> Something went wrong while trying to
                                cashout. Click{' '}
                                <Link href={createdLink ?? ''} className="underline">
                                    here
                                </Link>{' '}
                                to reclaim the funds to your wallet.
                            </Link>
                        )}
                    </div>
                </Card.Content>
            </Card>
        </div>
    )
}
