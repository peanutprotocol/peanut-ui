'use client'
import { type FC, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/Global/Modal'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
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
    const queryClient = useQueryClient()
    const [value, setValue] = useState<string>(initialAmountCents != null ? (initialAmountCents / 100).toFixed(2) : '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            setValue(initialAmountCents != null ? (initialAmountCents / 100).toFixed(2) : '')
            setError(null)
        }
    }, [isOpen, initialAmountCents])

    const save = async () => {
        const dollars = Number(value)
        if (!Number.isFinite(dollars) || dollars < 0) {
            setError('Enter a valid amount')
            return
        }
        const amountCents = Math.round(dollars * 100)
        setSaving(true)
        setError(null)
        try {
            const payload: RainCardLimit[] = [{ amount: amountCents, frequency }]
            await rainApi.updateCardLimits(cardId, payload)
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: [CARD_LIMITS_QUERY_KEY, cardId] }),
                queryClient.invalidateQueries({ queryKey: [RAIN_CARD_OVERVIEW_QUERY_KEY] }),
            ])
            onClose()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save limit')
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
                    <div className="text-xl font-extrabold">Change limit</div>
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
                        Save changes
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

export default CardLimitEditModal
