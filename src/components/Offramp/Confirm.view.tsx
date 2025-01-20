'use client'
import { sortCrossChainDetails } from '@/components/Claim/Claim.utils'
import useClaimLink from '@/components/Claim/useClaimLink'
import { useCreateLink } from '@/components/Create/useCreateLink'
import { CrispButton } from '@/components/CrispChat'
import Icon from '@/components/Global/Icon'
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
import { useCallback, useContext, useState } from 'react'

import {
    CrossChainDetails,
    IOfframpConfirmScreenProps,
    LiquidationAddress,
    OfframpType,
    optimismChainId,
    PeanutAccount,
    usdcAddressOptimism,
} from '@/components/Offramp/Offramp.consts'
import { Card } from '../0_Bruddle'
import { FAQComponent } from '../Cashout/Components/Faq.comp'
import FlowHeader from '../Global/FlowHeader'
import PromoCodeChecker from './PromoCodeChecker'

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

    //////////////////////
    // state and context vars for cashout offramp
    const { selectedChainID, selectedTokenAddress } = useContext(context.tokenSelectorContext)
    const [showRefund, setShowRefund] = useState(false)
    const { createLinkWrapper } = useCreateLink()
    const [createdLink, setCreatedLink] = useState<string | undefined>(undefined)

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
        if (!user || !selectedChainID || !selectedTokenAddress) {
            throw new Error('Missing user or token information')
        }

        const tokenType = utils.isNativeCurrency(selectedTokenAddress) ? 0 : 1
        const contractVersion = await getLatestContractVersion({
            chainId: selectedChainID,
            type: 'normal',
            experimental: false,
        })

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

        if (!peanutAccount || !bridgeCustomerId || !bridgeExternalAccountId) {
            throw new Error('Missing account information')
        }

        // Fetch all liquidation addresses for the user
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
        let tokenName = utils.getBridgeTokenName(claimLinkData.chainId, claimLinkData.tokenAddress)
        let chainName = utils.getBridgeChainName(claimLinkData.chainId)
        let xchainNeeded = false

        // if we don't have a token and chain name (meaning bridge supports it), we do x-chain transfer to optimism usdc
        if (!tokenName || !chainName) {
            xchainNeeded = true
            const result = await handleCrossChainScenario(claimLinkData)
            if (!result) {
                throw new Error('Failed to setup cross-chain transfer')
            }
            tokenName = result.tokenName
            chainName = result.chainName
        }

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
        claimLinkData: any, // TODO: fix type
        hash: string,
        liquidationAddress: LiquidationAddress,
        bridgeCustomerId: string,
        bridgeExternalAccountId: string,
        chainId: string,
        tokenName: string,
        peanutAccount: PeanutAccount
    ) => {
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

        await utils.submitCashoutLink({
            link: claimLinkData.link,
            bridgeCustomerId: bridgeCustomerId,
            liquidationAddressId: liquidationAddress.id,
            cashoutTransactionHash: hash, // has to be destination chain transaction hash!
            externalAccountId: bridgeExternalAccountId,
            chainId: chainId,
            tokenName: tokenName,
            promoCode: appliedPromoCode || '',
            trackParam: appliedPromoCode || '',
        })
    }

    const handleError = (error: unknown) => {
        console.error('Error in handleCashoutConfirm:', error)
        setErrorState({
            showError: true,
            errorMessage:
                error instanceof Error
                    ? error.message
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
            } finally {
                setLoadingState('Idle')
            }
        }
    }

    return (
        <div>
            <FlowHeader
                onPrev={() => {
                    onPrev()
                    setActiveStep(0)
                    setErrorState({ showError: false, errorMessage: '' })
                    setOfframpForm({ email: '', name: '', recipient: '', password: '' })
                }}
                disableBackBtn={isLoading}
                disableWalletHeader
            />

            <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header className="mx-auto">
                    <Card.Title className="mx-auto text-center">Confirm your details</Card.Title>
                    <Card.Description className="mx-auto text-center">
                        {offrampType == OfframpType.CASHOUT && (
                            <>
                                <label className="text-center text-h8 font-light">
                                    Cash out your crypto to your bank account. From any token, any chain, directly to
                                    your bank account.
                                </label>
                                <FAQComponent />
                            </>
                        )}
                        {offrampType == OfframpType.CLAIM && (
                            <label className="text-center text-h8 font-light">
                                Cash out this link's crypto to your bank account. Works best with popular stablecoins
                                and other commonly traded tokens.
                            </label>
                        )}
                    </Card.Description>
                </Card.Header>

                <Card.Content className="col gap-4">
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
                            <div className="flex w-full flex-col items-center justify-center gap-2">
                                <div className="text-grey-1 flex w-full flex-row items-center justify-between gap-1 px-2 text-h8">
                                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                                        <Icon name={'profile'} className="fill-grey-1 h-4" />
                                        <label className="font-bold">Name</label>
                                    </div>
                                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                        {user?.user?.full_name}
                                    </span>
                                </div>

                                <div className="text-grey-1 flex w-full flex-row items-center justify-between gap-1 px-2 text-h8">
                                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                                        <Icon name={'email'} className="fill-grey-1 h-4" />
                                        <label className="font-bold">Email</label>
                                    </div>
                                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                        {user?.user?.email}
                                    </span>
                                </div>

                                <div className="text-grey-1 flex w-full flex-row items-center justify-between gap-1 px-2 text-h8">
                                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                                        <Icon name={'bank'} className="fill-grey-1 h-4" />
                                        <label className="font-bold">Bank account</label>
                                    </div>
                                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                        {formatBankAccountDisplay(offrampForm.recipient)}
                                    </span>
                                </div>

                                {offrampType == OfframpType.CLAIM && (
                                    <div className="text-grey-1 flex w-full flex-row items-center justify-between gap-1 px-2 text-h8">
                                        <div className="flex w-max  flex-row items-center justify-center gap-1">
                                            <Icon name={'forward'} className="fill-grey-1 h-4" />
                                            <label className="font-bold">Route</label>
                                        </div>
                                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                            {
                                                consts.supportedPeanutChains.find(
                                                    (chain) => chain.chainId === claimLinkData?.chainId
                                                )?.name
                                            }{' '}
                                            <Icon name={'arrow-next'} className="fill-grey-1 h-4" /> Offramp{' '}
                                            <Icon name={'arrow-next'} className="fill-grey-1 h-4" />{' '}
                                            {recipientType?.toUpperCase()}{' '}
                                            <MoreInfo
                                                text={`Wait, crypto can be converted to real money??? How cool!`}
                                            />
                                        </span>
                                    </div>
                                )}

                                <div className="text-grey-1 flex w-full flex-row items-center px-2 text-h8">
                                    <div className="flex w-1/3 flex-row items-center gap-1">
                                        <Icon name={'gas'} className="fill-grey-1 h-4" />
                                        <label className="font-bold">Fee</label>
                                    </div>
                                    <div className="relative flex flex-1 items-center justify-end gap-1 text-sm font-normal">
                                        <div className="flex items-center gap-1">
                                            {appliedPromoCode
                                                ? '$0'
                                                : user?.accounts.find(
                                                        (account) =>
                                                            account.account_identifier
                                                                .replaceAll(/\s/g, '')
                                                                .toLowerCase() ===
                                                            offrampForm.recipient.replaceAll(/\s/g, '').toLowerCase()
                                                    )?.account_type === 'iban'
                                                  ? '$1'
                                                  : '$0.50'}
                                            <span className="inline-flex items-center">
                                                <MoreInfo
                                                    text={
                                                        appliedPromoCode
                                                            ? 'Fees waived with promo code!'
                                                            : `For ${
                                                                  user?.accounts.find(
                                                                      (account) =>
                                                                          account.account_identifier
                                                                              .replaceAll(/\s/g, '')
                                                                              .toLowerCase() ===
                                                                          offrampForm.recipient
                                                                              .replaceAll(/\s/g, '')
                                                                              .toLowerCase()
                                                                  )?.account_type === 'iban'
                                                                      ? 'SEPA'
                                                                      : 'ACH'
                                                              } transactions a fee of ${
                                                                  user?.accounts.find(
                                                                      (account) =>
                                                                          account.account_identifier
                                                                              .replaceAll(/\s/g, '')
                                                                              .toLowerCase() ===
                                                                          offrampForm.recipient
                                                                              .replaceAll(/\s/g, '')
                                                                              .toLowerCase()
                                                                  )?.account_type === 'iban'
                                                                      ? '$1'
                                                                      : '$0.50'
                                                              } is charged.`
                                                    }
                                                />
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-grey-1 flex w-full flex-row items-center px-2 text-h8">
                                    <div className="flex w-1/3 flex-row items-center gap-1">
                                        <Icon name={'transfer'} className="fill-grey-1 h-4" />
                                        <label className="font-bold">Total</label>
                                    </div>
                                    <div className="flex flex-1 items-center justify-end gap-1 text-sm font-normal">
                                        $
                                        {offrampType === OfframpType.CASHOUT
                                            ? utils.formatTokenAmount(parseFloat(usdValue ?? '0'))
                                            : tokenPrice && claimLinkData
                                              ? utils.formatTokenAmount(
                                                    tokenPrice * parseFloat(claimLinkData.tokenAmount)
                                                )
                                              : ''}{' '}
                                        <MoreInfo
                                            text={`This is the total amount before the ${
                                                user?.accounts.find(
                                                    (account) =>
                                                        account.account_identifier
                                                            .replaceAll(/\s/g, '')
                                                            .toLowerCase() ===
                                                        offrampForm.recipient.replaceAll(/\s/g, '').toLowerCase()
                                                )?.account_type === 'iban'
                                                    ? '$1 SEPA'
                                                    : '$0.50 ACH'
                                            } fee is deducted.`}
                                        />
                                    </div>
                                </div>

                                <div className="text-grey-1 flex w-full flex-row items-center justify-between px-2 text-h8">
                                    <div className="flex w-max flex-row items-center gap-1">
                                        <Icon name={'transfer'} className="fill-grey-1 h-4" />
                                        <label className="font-bold">You will receive</label>
                                    </div>
                                    <div className="flex items-center justify-end gap-1 text-sm font-normal">
                                        <div className="flex items-center gap-1">
                                            ${/* if promo code is applied, show full amount without fee deduction */}
                                            {appliedPromoCode
                                                ? offrampType == OfframpType.CASHOUT
                                                    ? utils.formatTokenAmount(parseFloat(usdValue ?? tokenValue ?? ''))
                                                    : tokenPrice &&
                                                      claimLinkData &&
                                                      utils.formatTokenAmount(
                                                          tokenPrice * parseFloat(claimLinkData.tokenAmount)
                                                      )
                                                : // if no promo code, apply fee deduction based on account type
                                                  user?.accounts.find(
                                                        (account) =>
                                                            account.account_identifier
                                                                .replaceAll(/\s/g, '')
                                                                .toLowerCase() ===
                                                            offrampForm.recipient.replaceAll(/\s/g, '').toLowerCase()
                                                    )?.account_type === 'iban'
                                                  ? offrampType == OfframpType.CASHOUT
                                                      ? utils.formatTokenAmount(
                                                            parseFloat(usdValue ?? tokenValue ?? '') - 1
                                                        )
                                                      : tokenPrice &&
                                                        claimLinkData &&
                                                        utils.formatTokenAmount(
                                                            tokenPrice * parseFloat(claimLinkData.tokenAmount) - 1
                                                        )
                                                  : offrampType == OfframpType.CASHOUT
                                                    ? utils.formatTokenAmount(parseFloat(usdValue ?? '') - 0.5)
                                                    : tokenPrice &&
                                                      claimLinkData &&
                                                      utils.formatTokenAmount(
                                                          tokenPrice * parseFloat(claimLinkData.tokenAmount) - 0.5
                                                      )}
                                            <MoreInfo
                                                text={
                                                    appliedPromoCode
                                                        ? 'Fees waived with promo code!'
                                                        : user?.accounts.find(
                                                                (account) =>
                                                                    account.account_identifier
                                                                        .replaceAll(/\s/g, '')
                                                                        .toLowerCase() ===
                                                                    offrampForm.recipient
                                                                        .replaceAll(/\s/g, '')
                                                                        .toLowerCase()
                                                            )?.account_type === 'iban'
                                                          ? 'For SEPA transactions a fee of $1 is charged. For ACH transactions a fee of $0.50 is charged. This will be deducted of the amount you will receive.'
                                                          : 'For ACH transactions a fee of $0.50 is charged. For SEPA transactions a fee of $1 is charged. This will be deducted of the amount you will receive.'
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>

                                <PromoCodeChecker
                                    onPromoCodeApplied={handlePromoCodeApplied}
                                    appliedPromoCode={appliedPromoCode!}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex w-full flex-col items-center justify-center gap-2">
                        {activeStep > 3 && (
                            <button
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
                                className="btn-purple btn-xl"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <div className="flex w-full flex-row items-center justify-center gap-2">
                                        <Loading /> {loadingState}
                                    </div>
                                ) : (
                                    'Cashout'
                                )}
                            </button>
                        )}

                        {errorState.showError && (
                            <div className="text-center">
                                {errorState.errorMessage === 'offramp unavailable' ? (
                                    <label className="text-h8 font-normal text-red">
                                        This token cannot be cashed out directly.{' '}
                                        <CrispButton className="text-blue-600 underline">Chat with support</CrispButton>
                                    </label>
                                ) : (
                                    <label className="text-h8 font-normal text-red">{errorState.errorMessage}</label>
                                )}
                            </div>
                        )}
                        {showRefund && (
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
