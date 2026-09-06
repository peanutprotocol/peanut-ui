'use client'
import { type FC, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import ActionModal from '@/components/Global/ActionModal'
import { rainApi, type RainCardLimit, type RainLimitFrequency } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'

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
            // The purchase limit is a Rain control only. What stays on the card
            // is its own setting (the On card screen), so no collateral moves here.
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
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            preventClose={saving}
            hideModalCloseButton={saving}
            icon="credit-card"
            title={t('editTitle')}
            content={
                <div className="flex w-full flex-col gap-2 text-left">
                    <label htmlFor="card-limit-input" className="text-label-l">
                        {label}
                    </label>
                    <div className="flex items-center gap-2 rounded-sm border border-border-default bg-background-default px-3 py-2">
                        <span className="text-foreground-secondary">$</span>
                        <input
                            id="card-limit-input"
                            type="number"
                            inputMode="decimal"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="w-full bg-transparent text-body-m focus:outline-none"
                            min={0}
                            step="0.01"
                            disabled={saving}
                        />
                    </div>
                    {error && <p className="text-body-s text-foreground-error">{error}</p>}
                </div>
            }
            ctas={[
                {
                    text: t('saveChanges'),
                    variant: 'purple',
                    shadowSize: '4',
                    onClick: save,
                    loading: saving,
                    disabled: saving,
                },
            ]}
        />
    )
}

export default CardLimitEditModal
