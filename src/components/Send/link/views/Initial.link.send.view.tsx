'use client'

import { useCreateLink } from '@/components/Create/useCreateLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import PeanutActionCard from '@/components/Global/PeanutActionCard'
import PeanutSponsored from '@/components/Global/PeanutSponsored'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { loadingStateContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useAppDispatch, useSendFlowStore } from '@/redux/hooks'
import { sendFlowActions } from '@/redux/slices/send-flow-slice'
import { ErrorHandler, printableUsdc } from '@/utils'
import { captureException } from '@sentry/nextjs'
import { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Button } from '../../../0_Bruddle'
import FileUploadInput from '../../../Global/FileUploadInput'
import MoreInfo from '../../../Global/MoreInfo'
import TokenAmountInput from '../../../Global/TokenAmountInput'
import { parseUnits } from 'viem'
import { sendLinksApi } from '@/services/sendLinks'

const LinkSendInitialView = () => {
    const dispatch = useAppDispatch()
    const { attachmentOptions, errorState } = useSendFlowStore()

    const { createLink } = useCreateLink()

    const { setLoadingState, loadingState, isLoading } = useContext(loadingStateContext)

    const [currentInputValue, setCurrentInputValue] = useState<string | undefined>('')
    const { fetchBalance, balance } = useWallet()

    const peanutWalletBalance = useMemo(() => {
        return printableUsdc(balance)
    }, [balance])

    const handleOnNext = useCallback(async () => {
        try {
            if (isLoading || !currentInputValue) return

            setLoadingState('Loading')

            // clear any previous errors
            dispatch(
                sendFlowActions.setErrorState({
                    showError: false,
                    errorMessage: '',
                })
            )

            const { link, pubKey, chainId, contractVersion, depositIdx, txHash } = await createLink(
                parseUnits(currentInputValue!, PEANUT_WALLET_TOKEN_DECIMALS)
            )

            dispatch(sendFlowActions.setLink(link))
            dispatch(sendFlowActions.setView('SUCCESS'))
            fetchBalance()

            // We dont need to wait for this to finish in order to proceed
            setTimeout(async () => {
                try {
                    await sendLinksApi.create({
                        pubKey,
                        chainId,
                        txHash,
                        contractVersion,
                        depositIdx,
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
    }, [isLoading, currentInputValue, createLink, fetchBalance])

    useEffect(() => {
        if (!peanutWalletBalance || !currentInputValue) return
        if (
            parseUnits(peanutWalletBalance, PEANUT_WALLET_TOKEN_DECIMALS) <
            parseUnits(currentInputValue, PEANUT_WALLET_TOKEN_DECIMALS)
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
    }, [peanutWalletBalance, currentInputValue])

    return (
        <div className="w-full space-y-4">
            <PeanutActionCard type="send" />

            <TokenAmountInput
                className="w-full"
                tokenValue={currentInputValue}
                maxValue={peanutWalletBalance}
                setTokenValue={setCurrentInputValue}
                onSubmit={handleOnNext}
                walletBalance={peanutWalletBalance}
            />

            <FileUploadInput
                attachmentOptions={attachmentOptions}
                setAttachmentOptions={(options) => dispatch(sendFlowActions.setAttachmentOptions(options))}
            />

            <PeanutSponsored />

            <div className="flex flex-col gap-4">
                <Button
                    onClick={handleOnNext}
                    loading={isLoading}
                    disabled={isLoading || !currentInputValue || !!errorState?.showError}
                >
                    {isLoading ? loadingState : 'Create link'}
                </Button>
                {errorState?.showError && <ErrorAlert description={errorState.errorMessage} />}
            </div>

            <span className="flex flex-row items-center justify-start gap-1 text-h8">
                Learn about Peanut cashout
                <MoreInfo
                    text={
                        <>
                            You can use Peanut to cash out your funds directly to your bank account! (US and EU only)
                            <br></br>{' '}
                            <a href="/cashout" className="hover:text-primary underline">
                                Learn more →
                            </a>
                        </>
                    }
                />
            </span>
        </div>
    )
}

export default LinkSendInitialView
