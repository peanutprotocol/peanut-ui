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
import { ErrorHandler } from '@/utils/friendly-error.utils'
import { INSUFFICIENT_BALANCE_MESSAGE, isAmountWithinBalance } from '@/utils/balance.utils'
import { captureException } from '@sentry/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useContext, useEffect, useMemo } from 'react'
import { parseUnits } from 'viem'
import { Button } from '@/components/0_Bruddle/Button'
import FileUploadInput from '../../../Global/FileUploadInput'
import AmountInput from '../../../Global/AmountInput'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

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

    const { fetchBalance, spendableBalance: balance, formattedSpendableBalance } = useWallet()
    const queryClient = useQueryClient()
    const { hasPendingTransactions } = usePendingTransactions()

    // Displayed total spendable (smart + collateral), single-sourced + formatted
    // by the hook. Empty while loading so we don't flash "$0.00".
    const peanutWalletBalance = useMemo(() => {
        return balance === undefined ? '' : formattedSpendableBalance
    }, [balance, formattedSpendableBalance])

    const handleOnNext = useCallback(async () => {
        try {
            if (isLoading || !tokenValue) return

            // Re-check affordability at submit too: the Retry button isn't disabled
            // on a balance error (unlike the other flows), so without this a blocked
            // amount could reach createLink. Only when the balance has loaded — else
            // a tap before the query resolves would false-reject. Gates on the
            // displayed total; an in-transit shortfall fails late with the settling copy.
            if (balance !== undefined && !isAmountWithinBalance(tokenValue, balance)) {
                setErrorState({ showError: true, errorMessage: INSUFFICIENT_BALANCE_MESSAGE })
                return
            }

            setLoadingState('Loading')

            // clear any previous errors
            setErrorState({ showError: false, errorMessage: '' })

            const { link, pubKey, chainId, contractVersion, depositIdx, txHash, amount, tokenAddress, preparationId } =
                await createLink(parseUnits(tokenValue!, PEANUT_WALLET_TOKEN_DECIMALS))

            posthog.capture(ANALYTICS_EVENTS.SEND_LINK_CREATED, {
                amount: tokenValue,
                chain_id: chainId,
                token_address: tokenAddress,
                has_attachment: !!attachmentOptions?.rawFile,
            })

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
                        preparationId,
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
            posthog.capture(ANALYTICS_EVENTS.SEND_LINK_FAILED, {
                amount: tokenValue,
                error_message: errorString,
            })
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
        balance,
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
        // Gate on the displayed total: block only a true shortfall. An in-transit
        // amount passes and fails late (settling message + refetch) — the FE balance
        // is ~30s-polled, so blocking it here would over-reject routable funds.
        if (!isAmountWithinBalance(tokenValue, balance)) {
            setErrorState({ showError: true, errorMessage: INSUFFICIENT_BALANCE_MESSAGE })
        } else {
            setErrorState({ showError: false, errorMessage: '' })
        }
    }, [peanutWalletBalance, balance, tokenValue, setErrorState, hasPendingTransactions, isLoading])

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
