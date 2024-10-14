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
import { useBalance } from '@/hooks/useBalance'
import { useWalletType } from '@/hooks/useWalletType'

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
    crossChainDetails,
    usdValue,
}: _consts.ICreateScreenProps) => {
    const [showMessage, setShowMessage] = useState(false)
    const { refetchBalances } = useBalance()

    const { selectedChainID, selectedTokenAddress, selectedTokenPrice, selectedTokenDecimals } = useContext(
        context.tokenSelectorContext
    )

    const { walletType } = useWalletType()

    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const {
        sendTransactions,
        signTypedData,
        makeDepositGasless,
        getLinkFromHash,
        submitClaimLinkInit,
        submitClaimLinkConfirm,
        submitDirectTransfer,
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

            let fileUrl = ''
            if (createType != 'direct') {
                const data = await submitClaimLinkInit({
                    password: password ?? '',
                    attachmentOptions: {
                        attachmentFile: attachmentOptions.rawFile,
                        message: attachmentOptions.message,
                    },
                    senderAddress: address ?? '',
                })
                fileUrl = data?.fileUrl
            }

            if (transactionType === 'not-gasless') {
                if (!preparedDepositTxs) return

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

            if (createType === 'direct') {
                utils.saveDirectSendToLocalStorage({
                    address: address ?? '',
                    data: {
                        chainId: selectedChainID,
                        tokenAddress: selectedTokenAddress,
                        tokenAmount: tokenValue ?? '0',
                        date: new Date().toISOString(),
                        points: estimatedPoints ?? 0,
                        txHash: hash,
                    },
                })

                await submitDirectTransfer({
                    txHash: hash,
                    chainId: selectedChainID,
                    senderAddress: address ?? '',
                    amountUsd: parseFloat(usdValue ?? '0'),
                    transaction: preparedDepositTxs && preparedDepositTxs.unsignedTxs[0],
                })
            } else {
                const link = await getLinkFromHash({ hash, linkDetails, password, walletType })

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
                await submitClaimLinkConfirm({
                    chainId: selectedChainID,
                    link: link[0],
                    password: password ?? '',
                    txHash: hash,
                    senderAddress: address ?? '',
                    amountUsd: parseFloat(usdValue ?? '0'),
                    transaction:
                        transactionType === 'not-gasless'
                            ? preparedDepositTxs && preparedDepositTxs.unsignedTxs[0]
                            : undefined,
                })

                if (createType === 'email_link') utils.shareToEmail(recipient.name ?? '', link[0], usdValue)
                if (createType === 'sms_link') utils.shareToSms(recipient.name ?? '', link[0], usdValue)
            }

            utils.updatePeanutPreferences({
                chainId: selectedChainID,
                tokenAddress: selectedTokenAddress,
                decimals: selectedTokenDecimals,
            })

            onNext()
            refetchBalances()
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
                    ? 'Text Tokens'
                    : createType == 'direct'
                      ? `Send to ${recipient.name?.endsWith('.eth') ? recipient.name : utils.printableAddress(recipient.address ?? '')}`
                      : `Send to ${recipient.name}`}
            </label>
            <label className="max-w-96 text-start text-h8 font-light">
                {createType === 'link' &&
                    'Make a payment with the link. Send the link to the recipient. They will be able to claim the funds in any token on any chain from the link.'}
                {createType === 'email_link' &&
                    `You will send an email to ${recipient.name ?? recipient.address} containing a link. They will be able to claim the funds in any token on any chain from the link.`}
                {createType === 'sms_link' &&
                    `You will send a text message to ${recipient.name ?? recipient.address} containing a link. They will be able to claim the funds in any token on any chain from the link.`}
                {createType === 'direct' &&
                    `You will send the tokens directly to ${recipient.name ?? recipient.address}. Ensure the recipient address is correct, else the funds might be lost.`}
            </label>
            <ConfirmDetails
                selectedChainID={selectedChainID}
                selectedTokenAddress={selectedTokenAddress}
                tokenAmount={tokenValue ?? '0'}
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
                {transactionCostUSD !== undefined && (
                    <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                        <div className="flex w-max flex-row items-center justify-center gap-1">
                            <Icon name={'gas'} className="h-4 fill-gray-1" />
                            <label className="font-bold">Network cost</label>
                        </div>
                        <label className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                            {transactionCostUSD === 0
                                ? '$0'
                                : transactionCostUSD < 0.01
                                  ? '$<0.01'
                                  : `$${utils.formatTokenAmount(transactionCostUSD, 3) ?? 0}`}
                            <MoreInfo
                                text={
                                    transactionCostUSD > 0
                                        ? `This transaction will cost you $${utils.formatTokenAmount(transactionCostUSD, 3)} in network fees.`
                                        : 'This transaction is sponsored by peanut! Enjoy!'
                                }
                            />
                        </label>
                    </div>
                )}
                <div className="flex w-full flex-row items-center justify-between px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'plus-circle'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Points</label>
                    </div>
                    <span className="flex flex-row items-center justify-center gap-1 text-center text-sm font-normal leading-4">
                        {estimatedPoints && estimatedPoints < 0 ? estimatedPoints : `+${estimatedPoints}`}
                        <MoreInfo
                            text={
                                estimatedPoints
                                    ? estimatedPoints > 0
                                        ? `This transaction will add ${estimatedPoints} to your total points balance.`
                                        : estimatedPoints < 0
                                          ? `This transaction will cost you ${estimatedPoints} points, but will not cost you any gas fees!`
                                          : 'This transaction will not add any points to your total points balance'
                                    : 'This transaction will not add any points to your total points balance'
                            }
                        />
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
                {!crossChainDetails.find((chain: any) => chain.chainId.toString() === selectedChainID.toString()) && (
                    <span className=" text-h8 font-normal ">
                        <Icon name="warning" className="-mt-0.5" /> This chain does not support cross-chain claiming.
                    </span>
                )}
            </div>
        </div>
    )
}
