'use client'
import { type FC, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import ActionModal from '@/components/Global/ActionModal'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { rainApi } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY, useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { InsufficientSpendableError, SessionKeyGrantRequiredError } from '@/hooks/wallet/spendPreflight'
import { useWallet } from '@/hooks/wallet/useWallet'
import { rainCentsToUsdcUnits } from '@/utils/balance.utils'

type Mode = 'lock' | 'unlock'
type Phase = 'prompt' | 'loading' | 'success' | 'error'

interface Props {
    cardId: string
    mode: Mode
    isOpen: boolean
    onClose: () => void
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

const LockCardModal: FC<Props> = ({ cardId, mode, isOpen, onClose }) => {
    const t = useTranslations('card')
    const [phase, setPhase] = useState<Phase>('prompt')
    const [error, setError] = useState<string | null>(null)
    const queryClient = useQueryClient()
    const { overview } = useRainCardOverview()
    const { address: smartWalletAddress } = useWallet()
    const { signSpend } = useSignSpendBundle()

    useEffect(() => {
        if (!isOpen) {
            // Reset on close so the next open starts fresh.
            setPhase('prompt')
            setError(null)
        }
    }, [isOpen])

    const copyKeys = COPY_KEYS[mode]

    const run = async () => {
        setPhase('loading')
        setError(null)
        try {
            if (mode === 'lock') {
                // An unloaded overview reads as zero spending power below, which
                // would skip the withdrawal and get the lock rejected by the
                // backend ("Withdrawal signature required"). Fail closed instead.
                if (!overview) {
                    throw new Error(t('errors.cardDetailsLoading'))
                }
                // If the user has spending power, return collateral to their
                // smart wallet BEFORE locking so funds stay liquid. The
                // backend gates the lock on a successful withdrawal — order
                // is handled there. We only need to deliver the signed body.
                const spendingPowerUnits = rainCentsToUsdcUnits(overview?.balance?.spendingPower)
                let verifiedWithdrawal: import('@/hooks/wallet/useSignSpendBundle').SignedRainWithdrawal | undefined
                if (spendingPowerUnits > 0n) {
                    if (!smartWalletAddress) {
                        throw new Error(t('errors.walletNotReady'))
                    }
                    // Routing MUST NOT pick smart-only here: the point of this
                    // spend is to drain Rain collateral back to the wallet, so a
                    // smart-account transfer would be a self-transfer no-op that
                    // leaves the collateral behind. (The `smartBalance: 0n` that
                    // used to force this was removed in cb302d35a.)
                    const artifact = await signSpend({
                        requiredUsdcAmount: spendingPowerUnits,
                        recipient: smartWalletAddress as `0x${string}`,
                        rainSpendingPower: spendingPowerUnits,
                        kind: 'CRYPTO_WITHDRAW',
                        forceStrategy: 'collateral-only',
                    })
                    if (artifact.strategy !== 'collateral-only') {
                        throw new Error(t('errors.unexpectedStrategy'))
                    }
                    verifiedWithdrawal = artifact.rainWithdrawal
                }
                await rainApi.lockCard(cardId, verifiedWithdrawal)
            } else {
                await rainApi.activateCard(cardId)
            }
            await queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] })
            posthog.capture(mode === 'lock' ? ANALYTICS_EVENTS.CARD_LOCKED : ANALYTICS_EVENTS.CARD_UNLOCKED)
            setPhase('success')
        } catch (e) {
            // Friendlier copy for the two known sign-time errors. Any other
            // throw (passkey cancelled, network, backend) keeps its message.
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

    const isSuccess = phase === 'success'

    return (
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            preventClose={phase === 'loading'}
            hideModalCloseButton={phase === 'loading'}
            tone="warning"
            icon="lock"
            title={t(isSuccess ? copyKeys.success : copyKeys.title)}
            description={t(isSuccess ? copyKeys.successBody : copyKeys.body)}
            content={
                isSuccess ? undefined : (
                    <>
                        {phase === 'error' && error && <p className="text-body-s text-foreground-error">{error}</p>}
                        {mode === 'lock' && (
                            <SlideToConfirm
                                label={phase === 'loading' ? t('lockModal.locking') : t('lockModal.slideToLock')}
                                onConfirm={run}
                                disabled={phase === 'loading'}
                            />
                        )}
                    </>
                )
            }
            ctas={
                !isSuccess && mode === 'unlock'
                    ? [
                          {
                              text: t('lockModal.unlockCta'),
                              variant: 'purple',
                              shadowSize: '4',
                              onClick: run,
                              loading: phase === 'loading',
                              disabled: phase === 'loading',
                          },
                      ]
                    : undefined
            }
        />
    )
}

export default LockCardModal
