'use client'
import { useContext, useState } from 'react'

import * as assets from '@/assets'
import * as context from '@/context'
import * as consts from '@/constants'
import * as _consts from '../Create.consts'
import * as _utils from '../Create.utils'
import * as utils from '@/utils'
import Icon from '@/components/Global/Icon'
import ConfirmDetails from '@/components/Global/ConfirmDetails/Index'
import { useCreateLink } from '../useCreateLink'
import Loading from '@/components/Global/Loading'
import { useAccount } from 'wagmi'
import { estimateContractGas } from 'viem/actions'
import MoreInfo from '@/components/Global/MoreInfo'

export const CreateLinkConfirmView = ({
    onNext,
    onPrev,
    transactionType,
    preparedDepositTxs,
    gaslessPayload,
    gaslessPayloadMessage,
    linkDetails,
    password,
    setTxHash,
    setLink,
    tokenValue,
    transactionCostUSD,
    feeOptions,
    estimatedPoints,
    attachmentOptions,
    createType,
    recipient,
}: _consts.ICreateScreenProps) => {
    const [showMessage, setShowMessage] = useState(false)

    const { selectedChainID, selectedTokenAddress, inputDenomination, selectedTokenPrice } = useContext(
        context.tokenSelectorContext
    )

    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const {
        sendTransactions,
        signTypedData,
        makeDepositGasless,
        getLinkFromHash,
        submitLinkAttachmentInit,
        submitLinkAttachmentConfirm,
    } = useCreateLink()
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)

    const { address } = useAccount()

    const handleConfirm = async () => {
        setLoadingState('Loading')

        setErrorState({
            showError: false,
            errorMessage: '',
        })

        try {
            let hash: string = ''

            let fileUrl
            if (createType != 'direct') {
                fileUrl = await submitLinkAttachmentInit({
                    password: password ?? '',
                    attachmentOptions: {
                        attachmentFile: attachmentOptions.rawFile,
                        message: attachmentOptions.message,
                    },
                })
            }

            if (transactionType === 'not-gasless') {
                if (!preparedDepositTxs) return
                console.log(preparedDepositTxs)
                hash =
                    (await sendTransactions({ preparedDepositTxs: preparedDepositTxs, feeOptions: feeOptions })) ?? ''
            } else {
                if (!gaslessPayload || !gaslessPayloadMessage) return
                setLoadingState('Sign in wallet')
                const signature = await signTypedData({ gaslessMessage: gaslessPayloadMessage })
                if (!signature) return
                setLoadingState('Executing transaction')
                hash = await makeDepositGasless({ signature, payload: gaslessPayload })
            }

            setTxHash(hash)

            setLoadingState('Creating link')

            if (createType != 'direct') {
                const link = await getLinkFromHash({ hash, linkDetails, password })

                await submitLinkAttachmentConfirm({
                    chainId: selectedChainID,
                    link: link[0],
                    password: password ?? '',
                    txHash: hash,
                })

                utils.saveCreatedLinkToLocalStorage({
                    address: address ?? '',
                    data: {
                        link: link[0],
                        depositDate: new Date().toISOString(),
                        USDTokenPrice: selectedTokenPrice ?? 0,
                        points: estimatedPoints ?? 0,
                        txHash: hash,
                        message: attachmentOptions.message ?? '',
                        attachmentUrl: fileUrl,
                        ...linkDetails,
                    },
                })

                setLink(link[0])
                console.log(link)
                if (createType === 'email_link') utils.shareToEmail(recipient, link[0])
                if (createType === 'sms_link') utils.shareToSms(recipient, link[0])
            }

            utils.updatePeanutPreferences({
                chainId: selectedChainID,
                tokenAddress: selectedTokenAddress,
            })

            onNext()
        } catch (error) {
            const errorString = utils.ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 text-center">
            <label className="text-h2">
                {createType == 'link'
                    ? 'Send crypto via link'
                    : createType == 'direct'
                      ? `Send to ${recipient.endsWith('.eth') ? recipient : utils.shortenAddressLong(recipient)}`
                      : `Send to ${recipient}`}
            </label>
            <label className="max-w-96 text-start text-h8 font-light">
                {createType === 'link' &&
                    'Deposit some crypto to the link, no need for wallet addresses. Send the link to the recipient. They will be able to claim the funds in any token on any chain from the link.'}
                {createType === 'email_link' &&
                    `You will send an email to ${recipient} containing a link. They will be able to claim the funds in any token on any chain from the link.`}
                {createType === 'sms_link' &&
                    `You will send a text message to ${recipient} containing a link. They will be able to claim the funds in any token on any chain from the link.`}
                {createType === 'direct' &&
                    `You will do a direct blockchain transaction to ${recipient}. Ensure the recipient address is correct, else the funds might be lost.`}
            </label>
            <ConfirmDetails
                selectedChainID={selectedChainID}
                selectedTokenAddress={selectedTokenAddress}
                tokenAmount={
                    inputDenomination === 'USD'
                        ? _utils
                              .convertUSDTokenValue({
                                  tokenPrice: selectedTokenPrice ?? 0,
                                  tokenValue: Number(tokenValue),
                              })
                              .toString()
                        : tokenValue ?? '0'
                }
                title="You're sending"
            />

            <div className="flex w-full flex-col items-center justify-center gap-2">
                {attachmentOptions.fileUrl && (
                    <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                        <div className="flex w-max flex-row items-center justify-center gap-1">
                            <Icon name={'paperclip'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Attachment</label>
                        </div>
                        <a href={attachmentOptions.fileUrl} download target="_blank">
                            <Icon name={'download'} className="h-4 fill-gray-1" />
                        </a>
                    </div>
                )}
                {attachmentOptions.message && (
                    <div className="flex w-full flex-col items-center justify-center gap-1">
                        <div
                            className="flex w-full  flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1"
                            onClick={() => {
                                setShowMessage(!showMessage)
                            }}
                        >
                            <div className="flex w-max flex-row items-center justify-center gap-1">
                                <Icon name={'paperclip'} className="h-4 fill-gray-1 " />
                                <label className=" font-bold">Message</label>
                            </div>
                            <Icon
                                name={'arrow-bottom'}
                                className={`h-4 cursor-pointer fill-gray-1 transition-transform ${showMessage && ' rotate-180'}`}
                            />
                        </div>
                        {showMessage && (
                            <div className="flex w-full flex-col items-center justify-center gap-1 pl-7 text-h8 text-gray-1">
                                <label className="w-full text-start text-sm font-normal leading-4">
                                    {attachmentOptions.message}
                                </label>
                            </div>
                        )}
                    </div>
                )}
                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'gas'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Network cost</label>
                    </div>
                    <label className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        ${utils.formatTokenAmount(transactionCostUSD, 3) ?? 0}
                        <MoreInfo
                            text={
                                transactionCostUSD
                                    ? `This transaction will cost you $${utils.formatTokenAmount(transactionCostUSD, 3)} in network fees.`
                                    : 'This transaction is sponsored by peanut! Enjoy!'
                            }
                        />
                    </label>
                </div>

                {/* <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'plus-circle'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Points</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        +{estimatedPoints ?? 0}{' '}
                        <MoreInfo
                            text={
                                estimatedPoints
                                    ? estimatedPoints > 0
                                        ? `This transaction will add ${estimatedPoints} to your total points balance.`
                                        : 'This transaction will not add any points to your total points balance'
                                    : 'This transaction will not add any points to your total points balance'
                            }
                        />
                    </span>
                </div> */}
                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'plus-circle'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Points</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        +??? <MoreInfo text={'Points coming soon! keep an eye out on your dashboard!'} />
                    </span>
                </div>
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <button className="btn-purple btn-xl" onClick={handleConfirm} disabled={isLoading}>
                    {isLoading ? (
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {loadingState}
                        </div>
                    ) : (
                        'Confirm'
                    )}
                </button>
                <button className="btn btn-xl" onClick={onPrev} disabled={isLoading}>
                    Return
                </button>
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}
