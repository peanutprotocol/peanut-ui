'use client'

import { useCallback, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import type { Address } from 'viem'
import posthog from 'posthog-js'
import * as Sentry from '@/utils/sentry-lazy'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import {
    aveniaApi,
    type AveniaWithdrawDisplay,
    type AveniaWithdrawRequest,
    type AveniaWithdrawSign,
} from '@/services/avenia'
import { wireErrorCode } from '@/services/api-error'
import { quoteMovedAgainstUser, signMatchesDisplay } from '@/features/avenia/avenia.utils'
import { useAveniaRefusalMessage } from '@/features/avenia/hooks/useAveniaRefusalMessage'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { BALANCE_DECREASE, PIX_WITHDRAW, TRANSACTIONS } from '@/constants/query.consts'
import { usePendingTransactions } from '@/hooks/wallet/usePendingTransactions'
import { areEvmAddressesEqual, isTxReverted } from '@/utils/general.utils'
import { friendlyError } from '@/utils/friendly-error.utils'
import { captureNetworkTriagedFailure, isNetworkLayerFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { rhinoDepositWithIdCalls } from '@/utils/rhino-deposit.utils'

/**
 * `reconfirm`: the opened quote is worse than the reviewed one and waits for a second Confirm.
 * `funded`: the deposit that funds the withdrawal is mined. Avenia has not paid the Pix yet:
 * the withdrawal's history entry says when it does.
 * `unconfirmed`: the deposit was sent but its receipt never arrived, so the app cannot say it landed.
 */
const flowTags = (step: string) => ({ ...criticalFlowTags('withdraw-avenia'), withdraw_step: step })

export type AveniaWithdrawPhase = 'idle' | 'starting' | 'reconfirm' | 'signing' | 'funded' | 'unconfirmed'

interface OpenedWithdrawal {
    intentId: string
    display: AveniaWithdrawDisplay
    sign: AveniaWithdrawSign
}

export interface AveniaWithdrawSubmit {
    /** Opens the withdrawal for the reviewed quote; signs at once unless the opened quote is worse. */
    submit: (request: AveniaWithdrawRequest, reviewed: AveniaWithdrawDisplay) => Promise<void>
    /** Signs the opened withdrawal once the user saw its new amounts (phase `reconfirm`). */
    confirmOpened: () => Promise<void>
    phase: AveniaWithdrawPhase
    /** The opened withdrawal: what the wallet signs, and what the review and success screens show. */
    opened: { intentId: string; display: AveniaWithdrawDisplay } | null
    error: string | null
    /**
     * True once Avenia's ticket is open. From then on only that ticket can be
     * signed: a second withdrawal could pay twice, and the API refuses one
     * while the first ticket is open anyway.
     */
    lockedAfterInit: boolean
}

/**
 * Confirm of a Pix withdrawal: POST /avenia/withdraw/init opens Avenia's
 * ticket and commits Rhino's quote, then the wallet signs the Rhino deposit
 * (approve + depositWithId, the same calls as a cross-chain bridge commit)
 * and the app reports the mined transaction. Rhino delivers the USDC to the
 * user's Avenia wallet on Base and Avenia pays the Pix.
 *
 * Init quotes again, seconds after the review. When that quote takes any more
 * USD or pays any fewer reais than the reviewed one, nothing is signed until
 * the user confirms the new amounts.
 *
 * `onOpened` gets the withdrawal's id as soon as the ticket is open, before
 * anything is signed, so the flow can put it in the URL. The signature is a
 * balance-decreasing mutation: while one is pending (`usePendingTransactions`),
 * no second withdrawal opens.
 */
export function useAveniaWithdrawSubmit({
    onOpened,
}: { onOpened?: (intentId: string) => void } = {}): AveniaWithdrawSubmit {
    const tShared = useTranslations('avenia')
    const initError = useAveniaRefusalMessage()
    const toFriendlyError = useFriendlyError()
    const queryClient = useQueryClient()
    const { sendTransactions } = useWallet()
    const { hasPendingTransactions } = usePendingTransactions()
    const { mutateAsync: sendDeposit } = useMutation({
        mutationKey: [BALANCE_DECREASE, PIX_WITHDRAW],
        // a second send of the same deposit could pay twice
        retry: false,
        mutationFn: ({ request, amount }: { request: AveniaWithdrawSign; amount: bigint }) =>
            sendTransactions(
                rhinoDepositWithIdCalls({
                    tokenAddress: request.tokenAddress as Address,
                    contractAddress: request.contractAddress as Address,
                    amount,
                    commitmentId: request.commitmentId,
                }),
                {
                    chainId: PEANUT_WALLET_CHAIN.id.toString(),
                    // Rhino's pay amount, so the collateral top-up covers what leaves
                    requiredUsdcAmount: amount,
                    kind: 'FIAT_OFFRAMP',
                }
            ),
    })
    const [phase, setPhase] = useState<AveniaWithdrawPhase>('idle')
    const [opened, setOpened] = useState<OpenedWithdrawal | null>(null)
    const [error, setError] = useState<string | null>(null)
    const busyRef = useRef(false)

    const sign = useCallback(
        async ({ intentId, sign: request }: OpenedWithdrawal) => {
            // Rhino's quote lives 3 minutes; a deposit on an expired commitment is not bridged
            if (!(Date.parse(request.quoteExpiresAt) > Date.now())) {
                setError(tShared('withdraw.errors.quoteExpired'))
                setPhase('idle')
                return
            }
            setPhase('signing')
            const amount = BigInt(request.payAmountUnits)
            let minedHash: string | undefined
            try {
                const result = await sendDeposit({ request, amount })
                if (result.receipt && isTxReverted(result.receipt)) {
                    throw new Error(`Transaction failed (reverted). Hash: ${result.receipt.transactionHash}`)
                }
                minedHash = result.receipt?.transactionHash
            } catch (caught) {
                posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, { method_type: 'avenia', stage: 'sign' })
                // A classified error is a user action or a known state; an unclassified or network
                // failure on the money leg is what prod-watch must see (as on the Manteca flow).
                const classified = friendlyError(caught)
                if (
                    (classified.kind === 'code' && classified.code === 'genericSupport') ||
                    isNetworkLayerFailure(caught)
                ) {
                    void captureNetworkTriagedFailure(caught, { tags: flowTags('sign'), extra: { intentId } })
                }
                setError(toFriendlyError(caught))
                setPhase('idle')
                return
            }
            void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
            void queryClient.invalidateQueries({ queryKey: ['balance'] })
            if (!minedHash) {
                // the wallet could not resolve the receipt: the deposit may still land, or fail
                setPhase('unconfirmed')
                return
            }
            setPhase('funded')
            // Optional for the money (Avenia's webhook moves it either way); it names the
            // funding transaction on the receipt sooner. Only a mined hash can be checked.
            aveniaApi.reportFunding(intentId, minedHash).catch((caught) => {
                Sentry.captureException(caught, { tags: flowTags('report-funding'), extra: { intentId } })
            })
        },
        [queryClient, sendDeposit, tShared, toFriendlyError]
    )

    const submit = useCallback(
        async (request: AveniaWithdrawRequest, reviewed: AveniaWithdrawDisplay) => {
            if (busyRef.current || opened || hasPendingTransactions) return
            busyRef.current = true
            setError(null)
            setPhase('starting')
            try {
                let init: Awaited<ReturnType<typeof aveniaApi.initWithdrawal>>
                try {
                    init = await aveniaApi.initWithdrawal(request)
                } catch (caught) {
                    const code = wireErrorCode(caught)
                    posthog.capture(ANALYTICS_EVENTS.WITHDRAW_FAILED, {
                        method_type: 'avenia',
                        stage: 'init',
                        error_code: code ?? 'unknown',
                    })
                    // a wire code is the API's own refusal; anything else is a failure to look at
                    if (!code) void captureNetworkTriagedFailure(caught, { tags: flowTags('init') })
                    setError(initError(caught))
                    setPhase('idle')
                    return
                }
                const withdrawal: OpenedWithdrawal = { intentId: init.intentId, display: init.display, sign: init.sign }
                setOpened(withdrawal)
                onOpened?.(init.intentId)
                // The wallet only ever approves its own USDC, for exactly the USD the user is shown;
                // anything else is a contract break.
                if (
                    init.sign.kind !== 'deposit-with-id' ||
                    !areEvmAddressesEqual(init.sign.tokenAddress, PEANUT_WALLET_TOKEN) ||
                    !signMatchesDisplay(init.display, init.sign)
                ) {
                    Sentry.captureException(new Error('Avenia withdrawal sign request off-contract'), {
                        tags: flowTags('sign-request'),
                        extra: { intentId: init.intentId, kind: init.sign.kind },
                    })
                    setError(tShared('unavailable'))
                    setPhase('idle')
                    return
                }
                if (quoteMovedAgainstUser(reviewed, init.display)) {
                    setPhase('reconfirm')
                    return
                }
                await sign(withdrawal)
            } finally {
                busyRef.current = false
            }
        },
        [hasPendingTransactions, initError, onOpened, opened, sign, tShared]
    )

    const confirmOpened = useCallback(async () => {
        if (busyRef.current || phase !== 'reconfirm' || !opened) return
        busyRef.current = true
        setError(null)
        try {
            await sign(opened)
        } finally {
            busyRef.current = false
        }
    }, [opened, phase, sign])

    return {
        submit,
        confirmOpened,
        phase,
        opened: opened ? { intentId: opened.intentId, display: opened.display } : null,
        error,
        lockedAfterInit: !!opened,
    }
}
