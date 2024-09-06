'use client'
import { useContext, useState } from 'react'
import * as context from '@/context'
import * as _consts from '../Cashout.consts'
import Loading from '@/components/Global/Loading'
import Icon from '@/components/Global/Icon'
import { useAuth } from '@/context/authContext'
import MoreInfo from '@/components/Global/MoreInfo'
import * as utils from '@/utils'
import { useCreateLink } from '@/components/Create/useCreateLink'
import { useSteps } from 'chakra-ui-steps'
import peanut, { getLatestContractVersion, getLinkDetails, getSquidRouteRaw } from '@squirrel-labs/peanut-sdk'
import { sortCrossChainDetails } from '@/components/Claim/Claim.utils'
import * as consts from '@/constants'
import { GlobalKYCComponent } from '@/components/Global/KYCComponent'
import { GlobaLinkAccountComponent } from '@/components/Global/LinkAccountComponent'
import useClaimLink from '@/components/Claim/useClaimLink'
import Link from 'next/link'
import { FAQComponent } from './Faq.comp'

export const ConfirmCashoutView = ({
    onNext,
    onPrev,
    usdValue,
    tokenValue,
    preparedCreateLinkWrapperResponse,
    initialKYCStep,
    offrampForm,
    setOfframpForm,
    setTransactionHash,
}: _consts.ICashoutScreenProps) => {
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const { user } = useAuth()
    const { selectedChainID, selectedTokenAddress } = useContext(context.tokenSelectorContext)
    const { claimLink, claimLinkXchain } = useClaimLink()
    const [showRefund, setShowRefund] = useState(false)
    const { createLinkWrapper } = useCreateLink()
    const [createdLink, setCreatedLink] = useState<string | undefined>(undefined)

    const handleConfirm = async () => {
        setLoadingState('Loading')
        setErrorState({
            showError: false,
            errorMessage: '',
        })

        try {
            if (!preparedCreateLinkWrapperResponse) return

            const tokenType = utils.isNativeCurrency(selectedTokenAddress) ? 0 : 1
            const contractVersion = await getLatestContractVersion({
                chainId: selectedChainID,
                type: 'normal',
                experimental: false,
            })
            const crossChainDetails = await getCrossChainDetails({
                chainId: selectedChainID,
                tokenType,
                contractVersion: contractVersion,
            })

            const link = await createLinkWrapper(preparedCreateLinkWrapperResponse)
            setCreatedLink(link)
            console.log(link)

            const claimLinkData = await getLinkDetails({ link: link })

            let tokenName = utils.getBridgeTokenName(claimLinkData.chainId, claimLinkData.tokenAddress)
            let chainName = utils.getBridgeChainName(claimLinkData.chainId)
            let xchainNeeded
            if (tokenName && chainName) {
                xchainNeeded = false
            } else {
                xchainNeeded = true
                const usdcAddressOptimism = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'
                const optimismChainId = '10'
                if (!crossChainDetails) {
                    setErrorState({
                        showError: true,
                        errorMessage: 'offramp unavailable',
                    })
                    return
                }

                let route
                try {
                    route = await utils.fetchRouteRaw(
                        claimLinkData.tokenAddress.toLowerCase,
                        claimLinkData.chainId.toString(),
                        usdcAddressOptimism,
                        optimismChainId,
                        claimLinkData.tokenDecimals,
                        claimLinkData.tokenAmount,
                        claimLinkData.senderAddress
                    )
                } catch (error) {
                    console.log('error', error)
                }

                if (route === undefined) {
                    setErrorState({
                        showError: true,
                        errorMessage: 'offramp unavailable',
                    })
                    setShowRefund(true)
                    return
                }

                tokenName = utils.getBridgeTokenName(optimismChainId, usdcAddressOptimism)
                chainName = utils.getBridgeChainName(optimismChainId)
            }

            if (!user || !chainName || !tokenName) return

            const peanutAccount = user.accounts.find(
                (account) =>
                    account.account_identifier?.toLowerCase().replaceAll(' ', '') ===
                    offrampForm?.recipient?.toLowerCase().replaceAll(' ', '')
            )
            const bridgeCustomerId = user?.user?.bridge_customer_id
            const bridgeExternalAccountId = peanutAccount?.bridge_account_id

            const recipientType = peanutAccount?.account_type

            if (!peanutAccount || !bridgeCustomerId || !bridgeExternalAccountId) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Something went wrong. Please try again.',
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
            if (!liquidationAddress)
                liquidationAddress = await utils.createLiquidationAddress(
                    bridgeCustomerId,
                    chainName,
                    tokenName,
                    bridgeExternalAccountId,
                    recipientType === 'iban' ? 'sepa' : 'ach',
                    recipientType === 'iban' ? 'eur' : 'usd'
                )

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
                    cashoutTransactionHash: hash,
                    externalAccountId: bridgeExternalAccountId,
                    chainId: chainId,
                    tokenName: tokenName,
                })

                setTransactionHash(hash)
                console.log('Transaction hash:', hash)
            }
            onNext()
            setLoadingState('Idle')
        } catch (error) {
            setErrorState({
                showError: true,
                errorMessage: 'Please enter a valid amount',
            })
            return
        } finally {
        }
    }

    const { setStep: setActiveStep, activeStep } = useSteps({
        initialStep: initialKYCStep,
    })

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

    return (
        <div className="flex w-full flex-col items-center justify-center gap-4 px-2  text-center">
            <label className="text-h4">Confirm your details</label>
            <div className="flex flex-col justify-center gap-3">
                <label className="text-start text-h8 font-light">
                    Cash out your crypto to your bank account. From any token, any chain, directly to your bank account.
                </label>
                <FAQComponent />
            </div>
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
                <div className="flex w-full flex-col items-center justify-center gap-2">
                    <label className="self-start text-h8 font-light">Please confirm all details:</label>
                    <div className="flex w-full flex-col items-center justify-center gap-2">
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
                            <div className="flex w-max  flex-row items-center justify-center gap-1">
                                <Icon name={'bank'} className="h-4 fill-gray-1" />
                                <label className="font-bold">Bank account</label>
                            </div>
                            <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                {offrampForm.recipient}
                            </span>
                        </div>
                        <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                            <div className="flex w-max  flex-row items-center justify-center gap-1">
                                <Icon name={'gas'} className="h-4 fill-gray-1" />
                                <label className="font-bold">Fee</label>
                            </div>
                            <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                {user?.accounts.find((account) => account.account_identifier === offrampForm.recipient)
                                    ?.account_type === 'iban'
                                    ? '$1'
                                    : '$0.50'}
                                <MoreInfo
                                    text={
                                        user?.accounts.find(
                                            (account) => account.account_identifier === offrampForm.recipient
                                        )?.account_type === 'iban'
                                            ? 'For SEPA transactions a fee of $1 is charged. For ACH transactions a fee of $0.50 is charged.'
                                            : 'For ACH transactions a fee of $0.50 is charged. For SEPA transactions a fee of $1 is charged.'
                                    }
                                />
                            </span>
                        </div>
                        <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                            <div className="flex w-max  flex-row items-center justify-center gap-1">
                                <Icon name={'transfer'} className="h-4 fill-gray-1" />
                                <label className="font-bold">Total</label>
                            </div>
                            <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                $
                                {user?.accounts.find((account) => account.account_identifier === offrampForm.recipient)
                                    ?.account_type === 'iban'
                                    ? utils.formatTokenAmount(parseFloat(usdValue ?? tokenValue ?? '') - 1)
                                    : utils.formatTokenAmount(parseFloat(usdValue ?? '') - 0.5)}
                                <MoreInfo
                                    text={
                                        user?.accounts.find(
                                            (account) => account.account_identifier === offrampForm.recipient
                                        )?.account_type === 'iban'
                                            ? 'For SEPA transactions a fee of $1 is charged. For ACH transactions a fee of $0.50 is charged. This will be deducted of the amount you will receive.'
                                            : 'For ACH transactions a fee of $0.50 is charged. For SEPA transactions a fee of $1 is charged. This will be deducted of the amount you will receive.'
                                    }
                                />
                            </span>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex w-full flex-col items-center justify-center gap-2">
                {activeStep > 3 ? (
                    <>
                        <button onClick={handleConfirm} className="btn-purple btn-xl" disabled={isLoading}>
                            {isLoading ? (
                                <div className="flex w-full flex-row items-center justify-center gap-2">
                                    <Loading /> {loadingState}
                                </div>
                            ) : (
                                'Cashout'
                            )}
                        </button>
                        <button
                            className="btn btn-xl dark:border-white dark:text-white"
                            onClick={() => {
                                onPrev()
                                setActiveStep(0)
                                setErrorState({ showError: false, errorMessage: '' })
                                setOfframpForm({ email: '', name: '', recipient: '', password: '' })
                            }}
                            disabled={isLoading}
                            type="button"
                        >
                            Return
                        </button>
                    </>
                ) : (
                    <button
                        className="btn btn-xl dark:border-white dark:text-white"
                        onClick={() => {
                            onPrev()
                            setActiveStep(0)
                            setErrorState({ showError: false, errorMessage: '' })
                            setOfframpForm({ email: '', name: '', recipient: '', password: '' })
                        }}
                        disabled={isLoading}
                        type="button"
                    >
                        Cancel
                    </button>
                )}

                {errorState.showError && errorState.errorMessage === 'KYC under review' ? (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">
                            KYC is under review, we might need additional documents. Please reach out via{' '}
                            <a href="https://discord.gg/uWFQdJHZ6j" target="_blank" className="underline">
                                discord
                            </a>{' '}
                            to finish the process.
                        </label>
                    </div>
                ) : errorState.errorMessage === 'KYC rejected' ? (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">
                            KYC has been rejected. Please reach out via{' '}
                            <a href="https://discord.gg/uWFQdJHZ6j" target="_blank" className="underline">
                                {' '}
                                discord{' '}
                            </a>{' '}
                            .
                        </label>
                    </div>
                ) : (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
                {showRefund && (
                    <Link href={createdLink ?? ''} className=" text-h8 font-normal ">
                        <Icon name="warning" className="-mt-0.5" /> Something went wrong while trying to cashout. Click
                        here to reclaim the link to your wallet.
                    </Link>
                )}
            </div>
        </div>
    )
}
