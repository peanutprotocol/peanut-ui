'use client'

import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import type { Address } from 'viem'
import posthog from 'posthog-js'
import * as Sentry from '@/utils/sentry-lazy'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { aveniaApi, type AveniaWithdrawDisplay, type AveniaWithdrawRequest } from '@/services/avenia'
import { API_ERROR_CODES, wireErrorCode } from '@/services/api-error'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { TRANSACTIONS } from '@/constants/query.consts'
import { areEvmAddressesEqual, isTxReverted } from '@/utils/general.utils'
import { rhinoDepositWithIdCalls } from '@/utils/rhino-deposit.utils'

export type AveniaWithdrawPhase = 'idle' | 'starting' | 'signing' | 'sent'

export interface AveniaWithdrawSubmit {
    submit: (request: AveniaWithdrawRequest) => Promise<void>
    phase: AveniaWithdrawPhase
    /** What the withdrawal was opened with: the success screen's amounts. */
    sent: { intentId: string; display: AveniaWithdrawDisplay } | null
    error: string | null
    /**
     * True once Avenia's ticket is open. From then on the screen offers no
     * retry: a second tap could pay twice, and the API refuses a second
     * withdrawal while the first ticket is open anyway.
     */
    lockedAfterInit: boolean
}

/**
 * Confirm of a Pix withdrawal: POST /avenia/withdraw/init opens Avenia's
 * ticket and commits Rhino's quote, then the wallet signs the Rhino deposit
 * (approve + depositWithId, the same calls as a cross-chain bridge commit)
 * and the app reports the mined transaction. Rhino delivers the USDC to the
 * user's Avenia wallet on Base and Avenia pays the Pix.
 */
export function useAveniaWithdrawSubmit(): AveniaWithdrawSubmit {
    const t = useTranslations('avenia.withdraw')
    const tShared = useTranslations('avenia')
    const tErrors = useTranslations('errors')
    const toFriendlyError = useFriendlyError()
    const queryClient = useQueryClient()
    const { sendTransactions } = useWallet()
    const [phase, setPhase] = useState<AveniaWithdrawPhase>('idle')
    const [sent, setSent] = useState<AveniaWithdrawSubmit['sent']>(null)
    const [error, setError] = useState<string | null>(null)
    const [lockedAfterInit, setLockedAfterInit] = useState(false)
    const busyRef = useRef(false)

    const initError = useCallback(
        (caught: unknown): string => {
            switch (wireErrorCode(caught)) {
                case API_ERROR_CODES.AVENIA_LIMIT_EXCEEDED:
                    return t('errors.limitExceeded')
                case API_ERROR_CODES.WITHDRAWAL_IN_PROGRESS:
                    return t('errors.inProgress')
                case API_ERROR_CODES.AVENIA_TICKET_WINDOW_SHORT:
                    return t('errors.quoteExpired')
                case API_ERROR_CODES.PIX_KEY_NOT_OWN:
                    return t('keyNotOwn')
                case API_ERROR_CODES.PIX_KEY_BLOCKED:
                    return t('keyBlocked')
                case API_ERROR_CODES.PROVIDER_REJECTED:
                    return tErrors('providerRejected')
                default:
                    return tShared('unavailable')
            }
        },
        [t, tShared, tErrors]
    )

    const submit = useCallback(
        async (request: AveniaWithdrawRequest) => {
            if (busyRef.current || lockedAfterInit) return
            busyRef.current = true
            setError(null)
            setPhase('starting')
            try {
                let init: Awaited<ReturnType<typeof aveniaApi.initWithdrawal>>
                try {
                    init = await aveniaApi.initWithdrawal(request)
                } catch (caught) {
                    posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, {
                        method_type: 'avenia',
                        stage: 'init',
                        error_code: wireErrorCode(caught) ?? 'unknown',
                    })
                    setError(initError(caught))
                    setPhase('idle')
                    return
                }
                setLockedAfterInit(true)
                const { sign, intentId } = init
                // The wallet only ever approves its own USDC; anything else is a contract break.
                if (sign.kind !== 'deposit-with-id' || !areEvmAddressesEqual(sign.tokenAddress, PEANUT_WALLET_TOKEN)) {
                    Sentry.captureException(new Error('Avenia withdrawal sign request off-contract'), {
                        extra: { intentId, kind: sign.kind },
                    })
                    setError(tShared('unavailable'))
                    setPhase('idle')
                    return
                }
                setPhase('signing')
                const amount = BigInt(sign.payAmountUnits)
                let minedHash: string | undefined
                try {
                    const result = await sendTransactions(
                        rhinoDepositWithIdCalls({
                            tokenAddress: sign.tokenAddress as Address,
                            contractAddress: sign.contractAddress as Address,
                            amount,
                            commitmentId: sign.commitmentId,
                        }),
                        {
                            chainId: PEANUT_WALLET_CHAIN.id.toString(),
                            // Rhino's pay amount, so the collateral top-up covers what leaves
                            requiredUsdcAmount: amount,
                            kind: 'FIAT_OFFRAMP',
                        }
                    )
                    if (result.receipt && isTxReverted(result.receipt)) {
                        throw new Error(`Transaction failed (reverted). Hash: ${result.receipt.transactionHash}`)
                    }
                    minedHash = result.receipt?.transactionHash
                } catch (caught) {
                    posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, { method_type: 'avenia', stage: 'sign' })
                    setError(toFriendlyError(caught))
                    setPhase('idle')
                    return
                }
                setSent({ intentId, display: init.display })
                setPhase('sent')
                // Optional for the money (Avenia's webhook moves it either way); it names the
                // funding transaction on the receipt sooner. Only a mined hash can be checked.
                if (minedHash) {
                    aveniaApi.reportFunding(intentId, minedHash).catch((caught) => {
                        Sentry.captureException(caught, { extra: { intentId } })
                    })
                }
                void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
                void queryClient.invalidateQueries({ queryKey: ['balance'] })
            } finally {
                busyRef.current = false
            }
        },
        [initError, lockedAfterInit, queryClient, sendTransactions, tShared, toFriendlyError]
    )

    return { submit, phase, sent, error, lockedAfterInit }
}
