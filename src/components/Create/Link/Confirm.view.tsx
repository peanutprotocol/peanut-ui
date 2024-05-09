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
    estiamtedPoints,
}: _consts.ICreateScreenProps) => {
    const { selectedChainID, selectedTokenAddress, inputDenomination, selectedTokenPrice } = useContext(
        context.tokenSelectorContext
    )
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const { sendTransactions, signTypedData, makeDepositGasless, getLinkFromHash } = useCreateLink()
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

            const link = await getLinkFromHash({ hash, linkDetails, password })

            utils.saveCreatedLinkToLocalStorage({
                address: address ?? '',
                data: {
                    link: link[0],
                    depositDate: new Date().toISOString(),
                    USDTokenPrice: selectedTokenPrice ?? 0,
                    points: estiamtedPoints ?? 0,
                    txHash: hash,
                    message: '', // TODO: update this
                    hasAttachment: false, // TODO: update this
                    ...linkDetails,
                },
            })
            utils.updatePeanutPreferences({
                chainId: selectedChainID,
                tokenAddress: selectedTokenAddress,
            })

            setLink(link[0])
            console.log(link)

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
            <label className="text-h2">Send crypto with a link</label>
            <label className="max-w-96 text-start text-h8 font-light">
                Choose the chain, set the amount, confirm the transaction. You’ll get a trustless payment link. They
                will be able to claim the funds in any token on any chain.
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
                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <Icon name={'gas'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Network cost</label>
                    </div>
                    <label className="text-sm font-normal leading-4">
                        ${utils.formatTokenAmount(transactionCostUSD, 3) ?? 0}
                    </label>
                </div>

                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-gray-1">
                    <div className="flex w-max  flex-row items-center justify-center gap-1">
                        <Icon name={'plus-circle'} className="h-4 fill-gray-1" />
                        <label className="font-bold">Points</label>
                    </div>
                    <label className="text-sm font-normal leading-4">+{estiamtedPoints ?? 0}</label>
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
                        <label className=" text-h8 text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </div>
    )
}
