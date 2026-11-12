'use client'
import { type FC, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import ActionModal from '@/components/Global/ActionModal'
import { Callout } from '@/components/0_Bruddle/Callout'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { useToast } from '@/components/0_Bruddle/Toast'
import CardReturnNotice from '@/components/Card/CardReturnNotice'
import CardStopNotice from '@/components/Card/CardStopNotice'
import { cardReturnFacts, cardReturnUnits } from '@/components/Card/cardReturn.utils'
import { rainApi, type CardCollateralReturn, type CardFundingStop } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import { newStopAttemptId, type StopAttempt } from '@/hooks/useCardStopConfirmation'
import { useStopAttemptReporter } from '@/hooks/useStopAttemptReporter'
import { useCardWithdrawalProof } from '@/hooks/wallet/useCardWithdrawalProof'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { InsufficientSpendableError, SessionKeyGrantRequiredError } from '@/hooks/wallet/spendPreflight'
import { useWallet } from '@/hooks/wallet/useWallet'
import { rainCentsToUsdcUnits } from '@/utils/balance.utils'

type Mode = 'lock' | 'unlock'
type Phase = 'prompt' | 'loading' | 'error' | 'done'

interface Props {
    cardId: string
    mode: Mode
    isOpen: boolean
    onClose: () => void
    onStopAttempt?: (attempt: StopAttempt | null) => void
}

const COPY_KEYS = {
    lock: {
        title: 'lockModal.lockTitle',
        body: 'lockModal.lockBody',
        success: 'lockModal.lockSuccess',
        successBody: 'lockModal.lockSuccessBody',
        failed: 'lockModal.lockFailed',
    },
    unlock: {
        title: 'lockModal.unlockTitle',
        body: 'lockModal.unlockBody',
        success: 'lockModal.unlockSuccess',
        successBody: 'lockModal.unlockSuccessBody',
        failed: 'lockModal.unlockFailed',
    },
} as const satisfies Record<Mode, Record<string, string>>

const LockCardModal: FC<Props> = ({ cardId, mode, isOpen, onClose, onStopAttempt }) => {
    const t = useTranslations('card')
    const tCommon = useTranslations('common')
    const [phase, setPhase] = useState<Phase>('prompt')
    const [error, setError] = useState<string | null>(null)
    const queryClient = useQueryClient()
    const { overview } = useRainCardOverview()
    const { address: smartWalletAddress } = useWallet()
    const { signSpend } = useSignSpendBundle()
    const toast = useToast()

    const [done, setDone] = useState<{
        attemptId: string
        stop?: CardFundingStop | null
        unlock?: 'kept' | 'unknown'
        collateralReturn?: CardCollateralReturn
    } | null>(null)
    const withdrawalProof = useCardWithdrawalProof(cardId, smartWalletAddress)
    const beginStopReport = useStopAttemptReporter(smartWalletAddress, onStopAttempt)

    useEffect(() => {
        if (!isOpen) {
            // Reset on close so the next open starts fresh.
            setPhase('prompt')
            setError(null)
            setDone(null)
        }
    }, [isOpen])

    const copyKeys = COPY_KEYS[mode]

    const run = async () => {
        setPhase('loading')
        setError(null)
        setDone(null)
        const report = beginStopReport()
        let stop: CardFundingStop | null | undefined
        let unlock: 'kept' | 'unknown' | undefined
        let collateralReturn: CardCollateralReturn | undefined
        try {
            if (mode === 'lock') {
                // An unloaded overview reads as zero spending power below, which
                // would skip the withdrawal: the backend then freezes the card
                // with the balance still in it (an older backend rejects the
                // lock, "Withdrawal signature required"). Fail closed instead.
                if (!overview) {
                    throw new Error(t('errors.cardDetailsLoading'))
                }
                // If the user has spending power, return collateral to their
                // smart wallet BEFORE locking so funds stay liquid. The
                // backend runs the signed return first and then locks the card
                // whatever the return did: `collateralReturn` says what is
                // left in the card. A backend that predates it refuses the
                // lock instead.
                const spendingPowerUnits = rainCentsToUsdcUnits(overview?.balance?.spendingPower)
                // Never more than the card holds: refund credit is not signed for.
                const returnUnits = cardReturnUnits(overview?.balance)
                // A retry reuses the proof: signing again could be a second withdrawal.
                let verifiedWithdrawal = withdrawalProof.get()
                if (!verifiedWithdrawal && returnUnits > 0n) {
                    if (!smartWalletAddress) {
                        throw new Error(t('errors.walletNotReady'))
                    }
                    // Routing MUST NOT pick smart-only here: the point of this
                    // spend is to drain Rain collateral back to the wallet, so a
                    // smart-account transfer would be a self-transfer no-op that
                    // leaves the collateral behind. (The `smartBalance: 0n` that
                    // used to force this was removed in cb302d35a.)
                    const artifact = await signSpend({
                        requiredUsdcAmount: returnUnits,
                        recipient: smartWalletAddress as `0x${string}`,
                        rainSpendingPower: spendingPowerUnits,
                        kind: 'CRYPTO_WITHDRAW',
                        forceStrategy: 'collateral-only',
                    })
                    if (artifact.strategy !== 'collateral-only') {
                        throw new Error(t('errors.unexpectedStrategy'))
                    }
                    verifiedWithdrawal = artifact.rainWithdrawal
                    withdrawalProof.save(verifiedWithdrawal)
                }
                // No draft back-out on a lockCard throw: the backend may have
                // consumed the withdrawal before the error surfaced — cleanup
                // belongs to the probe-verified TTL sweep (TASK-21815 review).
                const locked = await rainApi.lockCard(cardId, verifiedWithdrawal)
                stop = locked?.fundingStop
                collateralReturn = locked?.collateralReturn
                withdrawalProof.clear()
            } else {
                const resume = (await rainApi.activateCard(cardId))?.fundingStop
                // null: the card is active but the stop was not lifted; unlock again.
                unlock = resume === null ? 'unknown' : resume?.state === 'kept' ? 'kept' : undefined
            }
            // Before the overview refresh can unmount this screen. A kept or unknown stop stays reported.
            const attemptId = newStopAttemptId()
            if (stop && stop.state !== 'not_applicable') report({ attemptId, stop })
            else if (mode === 'unlock' && !unlock) report(null)
            await queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
            posthog.capture(mode === 'lock' ? ANALYTICS_EVENTS.CARD_LOCKED : ANALYTICS_EVENTS.CARD_UNLOCKED)
            // Stay open only when there is something true to say: about wallet
            // payments, or about a balance the freeze left in the card.
            if (unlock || (stop && stop.state !== 'not_applicable') || cardReturnFacts('lock', collateralReturn)) {
                setDone({ attemptId, stop, unlock, collateralReturn })
                setPhase('done')
                return
            }
            toast.success(t(copyKeys.success))
            onClose()
        } catch (e) {
            // A signature the backend used or can never verify is signed again on the next try.
            if (mode === 'lock') withdrawalProof.dropIfSpent(e)
            // Other throws (passkey cancelled, network, 409 card_action_*) keep their message.
            let message = e instanceof Error ? e.message : t(copyKeys.failed)
            if (e instanceof InsufficientSpendableError) {
                message = t('errors.balanceReturnFailed')
            } else if (e instanceof SessionKeyGrantRequiredError) {
                message = t('errors.authorizationFailed')
            }
            setError(message)
            posthog.capture(ANALYTICS_EVENTS.CARD_LOCK_FAILED, { mode, error_message: message })
            setPhase('error')
        }
    }

    const isDone = phase === 'done'
    const showError = phase === 'error' && !!error
    const showSlide = mode === 'lock' && !isDone
    const hasBody = showError || showSlide || isDone
    const bodyContent = (
        <>
            {showError && <Callout priority="error">{error}</Callout>}
            {done && (
                // the modal stacks its body with no gap, and two notices must not touch
                <div className="flex w-full flex-col gap-2">
                    <CardReturnNotice action="lock" collateralReturn={done.collateralReturn} />
                    <CardStopNotice
                        key={done.attemptId}
                        stop={done.stop}
                        attemptId={done.attemptId}
                        wallet={smartWalletAddress}
                        unlock={done.unlock}
                    />
                </div>
            )}
            {showSlide && (
                <SlideToConfirm
                    label={phase === 'loading' ? t('lockModal.locking') : t('lockModal.slideToLock')}
                    onConfirm={run}
                    disabled={phase === 'loading'}
                />
            )}
        </>
    )

    return (
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            preventClose={phase === 'loading'}
            hideModalCloseButton={phase === 'loading'}
            tone="attention"
            icon="lock"
            title={t(isDone ? copyKeys.success : copyKeys.title)}
            description={t(isDone ? copyKeys.successBody : copyKeys.body)}
            /* undefined, not an empty fragment: ActionModal reads a truthy
               `content` as "this modal has a body" and spaces it accordingly, so
               a fragment whose children are all absent buys the head margin and
               an empty wrapper for nothing. */
            content={hasBody ? bodyContent : undefined}
            ctas={
                // Unlock the wallet could not confirm: the same Unlock button retries it.
                isDone && done?.unlock !== 'unknown'
                    ? [{ text: tCommon('close'), variant: 'primary', onClick: onClose }]
                    : mode === 'unlock'
                      ? [
                            {
                                text: t('lockModal.unlockCta'),
                                variant: 'primary',
                                onClick: run,
                                loading: phase === 'loading',
                                disabled: phase === 'loading',
                            },
                        ]
                      : undefined
            }
            tertiaryCta={
                isDone && done?.unlock !== 'unknown'
                    ? undefined
                    : { text: tCommon('cancel'), onClick: onClose, disabled: phase === 'loading' }
            }
        />
    )
}

export default LockCardModal
