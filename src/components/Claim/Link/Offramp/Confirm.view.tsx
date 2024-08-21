'use client'

import * as _consts from '../../Claim.consts'
import * as context from '@/context'
import { useContext, useEffect, useState } from 'react'
import Loading from '@/components/Global/Loading'
import * as _interfaces from '../../Claim.interfaces'
import * as interfaces from '@/interfaces'

import { useForm } from 'react-hook-form'
import Icon from '@/components/Global/Icon'
import MoreInfo from '@/components/Global/MoreInfo'
import useClaimLink from '../../useClaimLink'
import * as utils from '@/utils'
import { useSteps } from 'chakra-ui-steps'
import * as consts from '@/constants'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { GlobalKYCComponent } from '@/components/Global/KYCComponent'
import { LinkAccountComponent } from '@/components/LinkAccount'
import { GlobaLinkAccountComponent } from '@/components/Global/LinkAccountComponent'

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
    userType,
    initialKYCStep,
}: _consts.IClaimScreenProps) => {
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const { claimLink, claimLinkXchain } = useClaimLink()

    // const handleSubmitTransfer = async () => {
    //     try {
    //         const formData = accountFormWatch()
    //         setLoadingState('Submitting Offramp')
    //         console.log('liquidationAddressInfo:', liquidationAddress)
    //         if (!liquidationAddress) return
    //         const chainId = utils.getChainIdFromBridgeChainName(offrampChainAndToken.chain) ?? ''
    //         const tokenAddress =
    //             utils.getTokenAddressFromBridgeTokenName(chainId ?? '10', offrampChainAndToken.token) ?? ''
    //         console.log({
    //             offrampXchainNeeded,
    //             offrampChainAndToken,
    //             liquidationAddress,
    //             claimLinkData,
    //             chainId,
    //             tokenAddress,
    //         })

    //         let hash
    //         if (offrampXchainNeeded) {
    //             const chainId = utils.getChainIdFromBridgeChainName(offrampChainAndToken.chain) ?? ''
    //             const tokenAddress =
    //                 utils.getTokenAddressFromBridgeTokenName(chainId ?? '10', offrampChainAndToken.token) ?? ''
    //             hash = await claimLinkXchain({
    //                 address: liquidationAddress.address,
    //                 link: claimLinkData.link,
    //                 destinationChainId: chainId,
    //                 destinationToken: tokenAddress,
    //             })
    //         } else {
    //             hash = await claimLink({
    //                 address: liquidationAddress.address,
    //                 link: claimLinkData.link,
    //             })
    //         }

    //         console.log(hash)

    //         if (hash) {
    //             utils.saveOfframpLinkToLocalstorage({
    //                 data: {
    //                     ...claimLinkData,
    //                     depositDate: new Date(),
    //                     USDTokenPrice: tokenPrice,
    //                     points: estimatedPoints,
    //                     txHash: hash,
    //                     message: attachment.message ? attachment.message : undefined,
    //                     attachmentUrl: attachment.attachmentUrl ? attachment.attachmentUrl : undefined,
    //                     liquidationAddress: liquidationAddress.address,
    //                     recipientType: recipientType,
    //                     accountNumber: formData.accountNumber,
    //                     bridgeCustomerId: peanutUser.bridge_customer_id,
    //                     bridgeExternalAccountId: peanutAccount.bridge_account_id,
    //                     peanutCustomerId: peanutUser.user_id,
    //                     peanutExternalAccountId: peanutAccount.account_id,
    //                 },
    //             })
    //             setTransactionHash(hash)
    //             console.log('Transaction hash:', hash)
    //             setLoadingState('Idle')
    //             onNext()
    //         }
    //     } catch (error) {
    //         console.error('Error during the submission process:', error)

    //         setErrorState({ showError: true, errorMessage: 'An error occurred. Please try again later' })
    //         setLoadingState('Idle')
    //     }
    // }

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
                <GlobaLinkAccountComponent accountNumber={offrampForm?.recipient} />
            ) : (
                <div className="flex w-full flex-col items-center justify-center gap-2">
                    <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                        <div className="flex w-max  flex-row items-center justify-center gap-1">
                            <Icon name={'profile'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Name</label>
                        </div>
                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            {offrampForm.name}
                        </span>
                    </div>
                    <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                        <div className="flex w-max  flex-row items-center justify-center gap-1">
                            <Icon name={'email'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Email</label>
                        </div>
                        <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            {offrampForm.email}
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
                            $0
                            <MoreInfo text={'Fees are on us, enjoy!'} />
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
                    </div>
                </div>
            )}

            <div className="flex w-full flex-col items-center justify-center gap-2">
                {activeStep > 3 && (
                    <button
                        onClick={() => {
                            console.log('hey')
                        }}
                        className="btn-purple btn-xl"
                        disabled={isLoading}
                    >
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
            </div>
        </div>
    )
}
