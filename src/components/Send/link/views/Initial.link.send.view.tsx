'use client'

import { useCreateLink } from '@/components/Create/useCreateLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import PeanutActionCard from '@/components/Global/PeanutActionCard'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { loadingStateContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch, useSendFlowStore } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { sendLinksApi } from '@/services/sendLinks'
import { ErrorHandler, printableUsdc } from '@/utils'
import { captureException } from '@sentry/nextjs'
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { parseUnits } from 'viem'
import { Button } from '../../../0_Bruddle'
import FileUploadInput from '../../../Global/FileUploadInput'
import TokenAmountInput from '../../../Global/TokenAmountInput'
import { useQueryClient } from '@tanstack/react-query'

const LinkSendInitialView = () => {
    const dispatch = useAppDispatch()
    const { attachmentOptions, errorState, tokenValue } = useSendFlowStore()

    const { createLink } = useCreateLink()

    const { setLoadingState, loadingState, isLoading } = useContext(loadingStateContext)

    const { fetchBalance, balance } = useWallet()
    const queryClient = useQueryClient()

    const peanutWalletBalance = useMemo(() => {
        return printableUsdc(balance)
    }, [balance])

    const handleOnNext = useCallback(async () => {
        try {
            if (isLoading || !tokenValue) return

            setLoadingState('Loading')

            // clear any previous errors
            dispatch(
                sendFlowActions.setErrorState({
                    showError: false,
                    errorMessage: '',
                })
            )

            const { link, pubKey, chainId, contractVersion, depositIdx, txHash, amount, tokenAddress } =
                await createLink(parseUnits(tokenValue!, PEANUT_WALLET_TOKEN_DECIMALS))

            dispatch(sendFlowActions.setLink(link))
            dispatch(sendFlowActions.setView('SUCCESS'))
            fetchBalance()
            queryClient.invalidateQueries({
                queryKey: ['transactions'],
            })

            // We dont need to wait for this to finish in order to proceed
            setTimeout(async () => {
                try {
                    await sendLinksApi.create({
                        pubKey,
                        chainId,
                        txHash,
                        contractVersion,
                        depositIdx,
                        amount,
                        tokenAddress,
                        reference: attachmentOptions?.message,
                        attachment: attachmentOptions?.rawFile,
                        filename: attachmentOptions?.rawFile?.name,
                        mimetype: attachmentOptions?.rawFile?.type,
                    })
                } catch (error) {
                    // We want to capture any errors here because we are already in the background
                    console.error(error)
                    captureException(error)
                }
            }, 0)
        } catch (error) {
            // handle errors
            const errorString = ErrorHandler(error)
            dispatch(
                sendFlowActions.setErrorState({
                    showError: true,
                    errorMessage: errorString,
                })
            )
            captureException(error)
        } finally {
            setLoadingState('Idle')
        }
    }, [isLoading, tokenValue, createLink, fetchBalance])

    useEffect(() => {
        if (!peanutWalletBalance || !tokenValue) return
        if (
            parseUnits(peanutWalletBalance, PEANUT_WALLET_TOKEN_DECIMALS) <
            parseUnits(tokenValue, PEANUT_WALLET_TOKEN_DECIMALS)
        ) {
            dispatch(
                sendFlowActions.setErrorState({
                    showError: true,
                    errorMessage: 'Insufficient balance',
                })
            )
        } else {
            dispatch(
                sendFlowActions.setErrorState({
                    showError: false,
                    errorMessage: '',
                })
            )
        }
    }, [peanutWalletBalance, tokenValue])

    return (
        <div className="w-full space-y-4">
            <PeanutActionCard type="send" />

            <TokenAmountInput
                className="w-full"
                tokenValue={tokenValue}
                setTokenValue={(value) => dispatch(sendFlowActions.setTokenValue(value))}
                maxValue={peanutWalletBalance}
                onSubmit={handleOnNext}
                walletBalance={peanutWalletBalance}
            />

            <FileUploadInput
                attachmentOptions={attachmentOptions}
                setAttachmentOptions={(options) => dispatch(sendFlowActions.setAttachmentOptions(options))}
            />

            <div className="flex flex-col gap-4">
                <Button
                    onClick={handleOnNext}
                    loading={isLoading}
                    disabled={isLoading || !tokenValue || !!errorState?.showError}
                >
                    {isLoading ? loadingState : 'Create link'}
                </Button>
                {errorState?.showError && <ErrorAlert description={errorState.errorMessage} />}
            </div>
        </div>
    )
}

export default LinkSendInitialView
