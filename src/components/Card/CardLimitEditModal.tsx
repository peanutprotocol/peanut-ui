'use client'
import { type FC, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import Modal from '@/components/Global/Modal'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { rainApi, type RainCardLimit, type RainLimitFrequency } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { useReturnExcessCollateral } from '@/hooks/wallet/useReturnExcessCollateral'

export const CARD_LIMITS_QUERY_KEY = 'rain-card-limits'

interface Props {
    cardId: string
    frequency: RainLimitFrequency
    label: string
    initialAmountCents?: number
    isOpen: boolean
    onClose: () => void
}

const CardLimitEditModal: FC<Props> = ({ cardId, frequency, label, initialAmountCents, isOpen, onClose }) => {
    const t = useTranslations('card.limits')
    const queryClient = useQueryClient()
    const { returnExcess } = useReturnExcessCollateral()
    const [value, setValue] = useState<string>(initialAmountCents != null ? (initialAmountCents / 100).toFixed(2) : '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            setValue(initialAmountCents != null ? (initialAmountCents / 100).toFixed(2) : '')
            setError(null)
            posthog.capture(ANALYTICS_EVENTS.CARD_LIMIT_CHANGE_OPENED, {
                frequency,
                initial_cents: initialAmountCents ?? null,
            })
        }
    }, [isOpen, initialAmountCents, frequency])

    const save = async () => {
        const dollars = Number(value)
        if (!Number.isFinite(dollars) || dollars < 0) {
            setError(t('invalidAmount'))
            return
        }
        const amountCents = Math.round(dollars * 100)
        setSaving(true)
        setError(null)
        try {
            const payload: RainCardLimit[] = [{ amount: amountCents, frequency }]
            await rainApi.updateCardLimits(cardId, payload)
            // The card's backing tracks the per-transaction limit. If it now
            // holds more than the new limit, return the difference to the
            // user's wallet — surfaced only as a passkey prompt. Ordering
            // matters: the PATCH above must land first so the auto-balancer's
            // target is already lowered and can't race the withdrawal by
            // topping the collateral back up.
            // Non-fatal: the limit change itself succeeded, the unified
            // displayed balance is identical either way, and re-saving the
            // limit retries the return — so a cancelled passkey or withdrawal
            // cooldown never blocks the modal.
            if (frequency === 'perAuthorization') {
                try {
                    const returnedCents = await returnExcess(amountCents)
                    if (returnedCents > 0) {
                        posthog.capture(ANALYTICS_EVENTS.CARD_LIMIT_EXCESS_RETURNED, {
                            returned_cents: returnedCents,
                            new_limit_cents: amountCents,
                        })
                    }
                } catch (excessError) {
                    posthog.capture(ANALYTICS_EVENTS.CARD_LIMIT_EXCESS_RETURN_FAILED, {
                        new_limit_cents: amountCents,
                        error_kind: (excessError as Error)?.name ?? 'unknown',
                        error_message: (excessError as Error)?.message,
                    })
                }
            }
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: [CARD_LIMITS_QUERY_KEY, cardId] }),
                queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] }),
            ])
            posthog.capture(ANALYTICS_EVENTS.CARD_LIMIT_CHANGED, {
                frequency,
                old_cents: initialAmountCents ?? null,
                new_cents: amountCents,
            })
            onClose()
        } catch (e) {
            const message = e instanceof Error ? e.message : t('saveFailed')
            setError(message)
            posthog.capture(ANALYTICS_EVENTS.CARD_LIMIT_CHANGE_FAILED, { frequency, error_message: message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal
            visible={isOpen}
            onClose={onClose}
            classWrap="sm:m-auto sm:self-center self-center m-4 rounded-2xl"
            preventClose={saving}
        >
            <div className="p-6">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-1">
                        <Icon name="credit-card" size={20} />
                    </div>
                    <div className="text-xl font-extrabold">{t('editTitle')}</div>
                    <div className="flex w-full flex-col gap-2 text-left">
                        <label htmlFor="card-limit-input" className="text-sm font-bold">
                            {label}
                        </label>
                        <div className="flex items-center gap-2 rounded-sm border border-n-1 bg-white px-3 py-2">
                            <span className="text-grey-1">$</span>
                            <input
                                id="card-limit-input"
                                type="number"
                                inputMode="decimal"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                className="w-full bg-transparent text-base focus:outline-none"
                                min={0}
                                step="0.01"
                                disabled={saving}
                            />
                        </div>
                        {error && <p className="text-sm text-red">{error}</p>}
                    </div>
                    <Button
                        variant="purple"
                        shadowSize="4"
                        className="w-full"
                        onClick={save}
                        loading={saving}
                        disabled={saving}
                    >
                        {t('saveChanges')}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

export default CardLimitEditModal
