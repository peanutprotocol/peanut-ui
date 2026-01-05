'use client'

import { useCreateLink } from '@/components/Create/useCreateLink'
import ErrorAlert from '@/components/Global/ErrorAlert'
import PeanutActionCard from '@/components/Global/PeanutActionCard'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { TRANSACTIONS } from '@/constants/query.consts'
import { loadingStateContext } from '@/context'
import { useLinkSendFlow } from '@/context/LinkSendFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { sendLinksApi } from '@/services/sendLinks'
import { ErrorHandler } from '@/utils/sdkErrorHandler.utils'
import { printableUsdc } from '@/utils/balance.utils'
import { captureException } from '@sentry/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { parseUnits } from 'viem'
import { Button } from '@/components/0_Bruddle/Button'
import FileUploadInput from '../../../Global/FileUploadInput'
import AmountInput from '../../../Global/AmountInput'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'

const LinkSendInitialView = () => {
    const {
        attachmentOptions,
        setAttachmentOptions,
        errorState,
        setErrorState,
        tokenValue,
        setTokenValue,
        setLink,
        setView,
    } = useLinkSendFlow()

    const { createLink } = useCreateLink()

    const { setLoadingState, isLoading } = useContext(loadingStateContext)

    const { fetchBalance, balance } = useWallet()
    const queryClient = useQueryClient()
    const { hasPendingTransactions } = usePendingTransactions()

    const peanutWalletBalance = useMemo(() => {
        return balance !== undefined ? printableUsdc(balance) : ''
    }, [balance])

    const handleOnNext = useCallback(async () => {
        try {
            if (isLoading || !tokenValue) return

            setLoadingState('Loading')

            // clear any previous errors
            setErrorState({ showError: false, errorMessage: '' })

            const { link, pubKey, chainId, contractVersion, depositIdx, txHash, amount, tokenAddress } =
                await createLink(parseUnits(tokenValue!, PEANUT_WALLET_TOKEN_DECIMALS))

            setLink(link)
            setView('SUCCESS')
            fetchBalance()
            queryClient.invalidateQueries({
                queryKey: [TRANSACTIONS],
            })

            // we dont need to wait for this to finish in order to proceed
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
                    // we want to capture any errors here because we are already in the background
                    console.error(error)
                    captureException(error)
                }
            }, 0)
        } catch (error) {
            // handle errors
            const errorString = ErrorHandler(error)
            setErrorState({ showError: true, errorMessage: errorString })
            captureException(error)
        } finally {
            setLoadingState('Idle')
        }
    }, [
        isLoading,
        tokenValue,
        createLink,
        fetchBalance,
        queryClient,
        setLoadingState,
        attachmentOptions,
        setLink,
        setView,
        setErrorState,
    ])

    useEffect(() => {
        // skip balance check if transaction is pending
        // (balance may be optimistically updated during transaction)
        // isLoading covers the createLink operation which directly uses handleSendUserOpEncoded
        if (hasPendingTransactions || isLoading) {
            return
        }

        if (!peanutWalletBalance || !tokenValue) {
            // clear error state when no balance or token value
            setErrorState({ showError: false, errorMessage: '' })
            return
        }
        if (
            parseUnits(peanutWalletBalance, PEANUT_WALLET_TOKEN_DECIMALS) <
            parseUnits(tokenValue, PEANUT_WALLET_TOKEN_DECIMALS)
        ) {
            setErrorState({ showError: true, errorMessage: 'Insufficient balance' })
        } else {
            setErrorState({ showError: false, errorMessage: '' })
        }
    }, [peanutWalletBalance, tokenValue, setErrorState, hasPendingTransactions, isLoading])

    return (
        <div className="w-full space-y-4">
            <PeanutActionCard type="send" />

            <AmountInput
                initialAmount={tokenValue}
                setPrimaryAmount={setTokenValue}
                onSubmit={handleOnNext}
                walletBalance={peanutWalletBalance}
            />

            <FileUploadInput
                className="h-11"
                placeholder="Comment"
                attachmentOptions={attachmentOptions}
                setAttachmentOptions={setAttachmentOptions}
            />

            <div className="flex flex-col gap-4">
                {errorState?.showError ? (
                    <Button shadowSize="4" icon="retry" onClick={handleOnNext} loading={isLoading} disabled={isLoading}>
                        Retry
                    </Button>
                ) : (
                    <Button
                        shadowSize="4"
                        onClick={handleOnNext}
                        loading={isLoading}
                        disabled={isLoading || !tokenValue || !!errorState?.showError}
                    >
                        {isLoading ? 'Creating link' : 'Create link'}
                    </Button>
                )}
                {errorState?.showError && <ErrorAlert description={errorState.errorMessage} />}
            </div>
        </div>
    )
}

export default LinkSendInitialView
