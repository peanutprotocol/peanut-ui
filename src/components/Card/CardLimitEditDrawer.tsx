'use client'
import { type FC, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useFormatter, useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { Field } from '@/components/0_Bruddle/Field'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { rainApi, type RainCardLimit, type RainLimitFrequency } from '@/services/rain'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'

export const CARD_LIMITS_QUERY_KEY = 'rain-card-limits'
const MAX_CARD_LIMIT_CENTS = 2_147_483_647

interface Props {
    cardId: string
    frequency: RainLimitFrequency
    label: string
    initialAmountCents?: number
    isOpen: boolean
    onClose: () => void
}

const CardLimitEditDrawer: FC<Props> = ({ cardId, frequency, label, initialAmountCents, isOpen, onClose }) => {
    const t = useTranslations('card.limits')
    const format = useFormatter()
    const queryClient = useQueryClient()
    const [value, setValue] = useState<string>(initialAmountCents != null ? (initialAmountCents / 100).toFixed(2) : '')
    const [saving, setSaving] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [apiError, setApiError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            setValue(initialAmountCents != null ? (initialAmountCents / 100).toFixed(2) : '')
            setValidationError(null)
            setApiError(null)
            posthog.capture(ANALYTICS_EVENTS.CARD_LIMIT_CHANGE_OPENED, {
                frequency,
                initial_cents: initialAmountCents ?? null,
            })
        }
    }, [isOpen, initialAmountCents, frequency])

    const save = async () => {
        const dollars = Number(value)
        const amountCents = Math.round(dollars * 100)
        setApiError(null)
        if (
            !Number.isFinite(dollars) ||
            amountCents < 1 ||
            amountCents > MAX_CARD_LIMIT_CENTS ||
            Math.abs(dollars * 100 - amountCents) > 0.000001
        ) {
            setValidationError(
                t('invalidAmount', {
                    minimum: format.number(0.01, { style: 'currency', currency: 'USD' }),
                    maximum: format.number(MAX_CARD_LIMIT_CENTS / 100, { style: 'currency', currency: 'USD' }),
                })
            )
            return
        }
        setSaving(true)
        setValidationError(null)
        try {
            const payload: RainCardLimit[] = [{ amount: amountCents, frequency }]
            await rainApi.updateCardLimits(cardId, payload)
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
            await Promise.allSettled([
                queryClient.invalidateQueries({ queryKey: [CARD_LIMITS_QUERY_KEY, cardId] }),
                queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] }),
            ])
            const message = e instanceof Error ? e.message : t('saveFailed')
            setApiError(message)
            posthog.capture(ANALYTICS_EVENTS.CARD_LIMIT_CHANGE_FAILED, { frequency, error_message: message })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Drawer
            open={isOpen}
            // a save in flight must not be abandoned by a swipe or overlay tap
            dismissible={!saving}
            onOpenChange={(open) => {
                if (!open && !saving) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm. no icon bubble — visual-qa verdict. */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('editTitle')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col gap-4">
                        {apiError && <Callout priority="error">{apiError}</Callout>}
                        <Field label={label} htmlFor="card-limit-input" error={validationError} className="text-left">
                            <BaseInput
                                id="card-limit-input"
                                type="number"
                                inputMode="decimal"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                leftContent={<span className="text-foreground-secondary">$</span>}
                                min={0.01}
                                max={MAX_CARD_LIMIT_CENTS / 100}
                                step="0.01"
                                disabled={saving}
                            />
                        </Field>
                        <Button
                            variant="primary"
                            className="w-full justify-center"
                            onClick={save}
                            loading={saving}
                            disabled={saving}
                        >
                            {t('saveChanges')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default CardLimitEditDrawer
