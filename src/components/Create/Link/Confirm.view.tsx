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

    const handleConfirm = async () => {
        setLoadingState('loading')

        setErrorState({
            showError: false,
            errorMessage: '',
        })

        try {
            let hash: string = ''

            if (transactionType === 'normal') {
                if (!preparedDepositTxs) return
                hash = (await sendTransactions({ preparedDepositTxs: preparedDepositTxs })) ?? ''
            } else {
                if (!gaslessPayload || !gaslessPayloadMessage) return
                setLoadingState('sign in wallet')
                const signature = await signTypedData({ gaslessMessage: gaslessPayloadMessage })
                if (!signature) return
                setLoadingState('executing transaction')
                hash = await makeDepositGasless({ signature, payload: gaslessPayload })
            }

            setTxHash(hash)

            setLoadingState('creating link')

            const link = await getLinkFromHash({ hash, linkDetails, password })

            setLink(link[0])
            console.log(link)

            onNext('normal')
        } catch (error) {
            const errorString = utils.ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
        } finally {
            setLoadingState('idle')
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

            <div className="flex w-full max-w-96 flex-row items-center justify-between ">
                <label className="text-sm font-bold text-gray-1">Network cost</label>
                <div className="flex flex-row items-center justify-center gap-1">
                    <Icon name={'gas'} className="h-4 fill-white" />
                    <label className="text-sm leading-4">$0.68</label>
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
                <button className="btn btn-xl" onClick={() => onPrev('normal')} disabled={isLoading}>
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
