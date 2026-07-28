'use client'
import { type FC, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import Modal from '@/components/Global/Modal'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import SlideToAction from '@/components/Card/SlideToAction'
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
                    // Force collateral-only routing: smart=0n eliminates the
                    // smart-only and mixed branches, so the strategy resolver
                    // picks 'collateral-only' and signs a Rain withdrawal
                    // straight to the user's smart wallet (1 passkey tap).
                    const artifact = await signSpend({
                        requiredUsdcAmount: spendingPowerUnits,
                        recipient: smartWalletAddress as `0x${string}`,
                        rainSpendingPower: spendingPowerUnits,
                        kind: 'CRYPTO_WITHDRAW',
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

    return (
        <Modal visible={isOpen} onClose={onClose} classWrap="sm:m-auto sm:self-center self-center m-4">
            <div className="p-6">
                {phase === 'success' ? (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-1">
                            <Icon name="lock" size={20} />
                        </div>
                        <div className="text-xl font-extrabold">{t(copyKeys.success)}</div>
                        <p className="text-sm text-grey-1">{t(copyKeys.successBody)}</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-1">
                            <Icon name="lock" size={20} />
                        </div>
                        <div className="text-xl font-extrabold">{t(copyKeys.title)}</div>
                        <p className="text-sm text-grey-1">{t(copyKeys.body)}</p>
                        {phase === 'error' && error && <p className="text-sm text-red">{error}</p>}
                        {mode === 'lock' ? (
                            <SlideToAction
                                label={phase === 'loading' ? t('lockModal.locking') : t('lockModal.slideToLock')}
                                onComplete={run}
                                disabled={phase === 'loading'}
                            />
                        ) : (
                            <Button
                                variant="purple"
                                shadowSize="4"
                                className="w-full"
                                onClick={run}
                                loading={phase === 'loading'}
                                disabled={phase === 'loading'}
                            >
                                {t('lockModal.unlockCta')}
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    )
}

export default LockCardModal
