'use client'

import * as _consts from '../../Claim.consts'
import * as context from '@/context'
import { useContext, useState } from 'react'
import Loading from '@/components/Global/Loading'
import * as _interfaces from '../../Claim.interfaces'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import useClaimLink from '../../useClaimLink'
import * as utils from '@/utils'
import { useSteps } from 'chakra-ui-steps'
import * as consts from '@/constants'
import { GlobalKYCComponent } from '@/components/Global/KYCComponent'
import { GlobaLinkAccountComponent } from '@/components/Global/LinkAccountComponent'
import { useAuth } from '@/context/authContext'
import { CrispButton } from '@/components/CrispChat'

export const ConfirmClaimLinkIbanView = ({
    onPrev,
    onNext,
    offrampForm,
    setOfframpForm,
    claimLinkData,
    recipientType,
    setTransactionHash,
    tokenPrice,
    attachment,
    estimatedPoints,
    crossChainDetails,
    initialKYCStep,
}: _consts.IClaimScreenProps) => {
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const { claimLink, claimLinkXchain } = useClaimLink()
    const { fetchUser, user } = useAuth()

    const handleSubmitTransfer = async () => {
        try {
            setLoadingState('Submitting Offramp')

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
                    console.error('error fetching route', error)
                }

                if (route === undefined) {
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
                    account.account_identifier?.toLowerCase().replaceAll(' ', '') ===
                    offrampForm?.recipient?.toLowerCase().replaceAll(' ', '')
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

    const { setStep: setActiveStep, activeStep } = useSteps({
        initialStep: initialKYCStep,
    })

    const handleCompleteKYC = async (message: string) => {
        if (message === 'account found') {
            setActiveStep(4)
        } else if (message === 'KYC completed') {
            setActiveStep(3)
        }
    }

    const handleCompleteLinkAccount = async (message: string) => {
        if (message === 'success') {
            setActiveStep(4)
        }
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 px-2  text-center">
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
                            {offrampForm?.recipient}
                        </span>
                    </div>

                    <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                        <div className="flex w-max  flex-row items-center justify-center gap-1">
                            <Icon name={'forward'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Route</label>
                        </div>
                        {false ? (
                            <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                {
                                    consts.supportedPeanutChains.find(
                                        (chain) => chain.chainId === claimLinkData.chainId
                                    )?.name
                                }{' '}
                                <Icon name={'arrow-next'} className="h-4 fill-gray-1" /> Optimism{' '}
                                <Icon name={'arrow-next'} className="h-4 fill-gray-1" /> {recipientType.toUpperCase()}{' '}
                                <MoreInfo text={`Wait, crypto can be converted to real money??? How cool!`} />
                            </span>
                        ) : (
                            <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                                Offramp <Icon name={'arrow-next'} className="h-4 fill-gray-1" />{' '}
                                {recipientType.toUpperCase()}{' '}
                                <MoreInfo text={`Wait, crypto can be converted to real money??? How cool!`} />
                            </span>
                        )}
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
                            ${utils.formatTokenAmount(tokenPrice * parseFloat(claimLinkData.tokenAmount))}{' '}
                            <MoreInfo text={'Woop Woop free offramp!'} />
                        </span>
                        <div className="flex w-max  flex-row items-center justify-center gap-1">
                            <Icon name={'transfer'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Total</label>
                        </div>
                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            $
                            {user?.accounts.find((account) => account.account_identifier === offrampForm.recipient)
                                ?.account_type === 'iban'
                                ? utils.formatTokenAmount(tokenPrice * parseFloat(claimLinkData.tokenAmount) - 1)
                                : utils.formatTokenAmount(tokenPrice * parseFloat(claimLinkData.tokenAmount) - 0.5)}
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
            )}

            <div className="flex w-full flex-col items-center justify-center gap-2">
                {activeStep > 3 && (
                    <button onClick={handleSubmitTransfer} className="btn-purple btn-xl" disabled={isLoading}>
                        {isLoading ? (
                            <div className="flex w-full flex-row items-center justify-center gap-2">
                                <Loading /> {loadingState}
                            </div>
                        ) : (
                            'Claim now'
                        )}
                    </button>
                )}
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
                {errorState.showError && errorState.errorMessage === 'KYC under review' ? (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">
                            KYC is under review, we might need additional documents. Chat with support to finish the
                            process.
                        </label>
                        <CrispButton className="text-blue-600 underline">Chat with support</CrispButton>
                    </div>
                ) : errorState.errorMessage === 'KYC rejected' ? (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">KYC has been rejected.</label>{' '}
                        <CrispButton className="text-blue-600 underline">Chat with support</CrispButton>
                    </div>
                ) : (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}
