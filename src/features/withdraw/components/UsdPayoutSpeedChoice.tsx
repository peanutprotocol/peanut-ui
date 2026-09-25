'use client'

import { useEffect, useState } from 'react'
import { Checkbox } from '@/components/0_Bruddle/Checkbox'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { Icon } from '@/components/Global/Icons/Icon'
import { formatBankAmount } from '@/utils/currency'
import { twMerge } from '@/utils/tw'
import { useTranslations } from 'next-intl'
import { type UsdPayoutSpeed, type UsdPayoutSpeedOption } from '../usd-payout-speed'

interface UsdPayoutSpeedChoiceProps {
    options: UsdPayoutSpeedOption[]
    selected: UsdPayoutSpeed
    onSelect: (speed: UsdPayoutSpeed) => void
    /** the transfer is created with the speed; it cannot change after */
    disabled?: boolean
}

/**
 * Bank transfer (ACH) or wire for a USD withdrawal (TASK-23054). ACH is the
 * default; under it, a checkbox asks for same-day ACH at no fee. Each row
 * states its arrival and its fee before anything is confirmed, and a wire that
 * cannot be picked says why. Selected rows follow design.md "selected list
 * rows": the fill and a trailing check, with the option semantics on a
 * wrapper because ListItem forwards no role.
 */
export function UsdPayoutSpeedChoice({ options, selected, onSelect, disabled = false }: UsdPayoutSpeedChoiceProps) {
    const t = useTranslations('withdraw.bank')
    const isAch = selected !== 'wire'
    // The same-day choice outlives a detour to wire: going back to ACH brings
    // back what the checkbox said. Ephemeral UI state; the URL holds the rail.
    const [sameDay, setSameDay] = useState(selected === 'ach_same_day')
    useEffect(() => {
        if (selected !== 'wire') setSameDay(selected === 'ach_same_day')
    }, [selected])

    const ach = options.find((option) => option.speed === 'ach')
    const achSameDay = options.find((option) => option.speed === 'ach_same_day')
    const wire = options.find((option) => option.speed === 'wire')
    const rows = [ach, wire].filter((option): option is UsdPayoutSpeedOption => !!option)

    const feeText = (option: UsdPayoutSpeedOption) =>
        Number(option.feeUsd) > 0
            ? t('speedFee', { fee: formatBankAmount(Number(option.feeUsd), 'USD') })
            : t('speedFree')

    return (
        <div className="flex flex-col gap-2">
            <MiniHeader>{t('speedLabel')}</MiniHeader>
            <div role="radiogroup" aria-label={t('speedLabel')} className="flex flex-col gap-2">
                {rows.map((option) => {
                    const isWire = option.speed === 'wire'
                    const isSelected = isWire ? !isAch : isAch
                    const isBlocked = !!option.block
                    const canPick = !disabled && !isBlocked
                    const pick = () => onSelect(isWire ? 'wire' : sameDay && achSameDay ? 'ach_same_day' : 'ach')
                    const paint = isSelected ? 'text-foreground-over-color-primary' : undefined
                    const body =
                        option.block === 'belowMinimum'
                            ? t('speedBelowMinimum', { amount: formatBankAmount(Number(option.minimumUsd), 'USD') })
                            : option.block === 'accountCannotTake'
                              ? t('speedAccountCannotTake')
                              : t(isWire ? 'speedWireBody' : 'speedAchBody')
                    return (
                        <div key={option.speed}>
                            <div
                                role="radio"
                                aria-checked={isSelected}
                                aria-disabled={!canPick || undefined}
                                tabIndex={canPick ? 0 : -1}
                                onClick={canPick ? pick : undefined}
                                onKeyDown={(event) => {
                                    if (!canPick || (event.key !== 'Enter' && event.key !== ' ')) return
                                    event.preventDefault()
                                    pick()
                                }}
                                data-testid={`usd-speed-${isWire ? 'wire' : 'ach'}`}
                                className={twMerge(
                                    'focus-visible:outline-[3px] focus-visible:outline-action-focus',
                                    canPick && 'cursor-pointer'
                                )}
                            >
                                <ListItem
                                    // one card per speed: the same-day option sits between them
                                    position="solo"
                                    disabled={isBlocked}
                                    className={twMerge(
                                        'transition-colors duration-instant',
                                        isSelected && 'bg-action-primary'
                                    )}
                                    title={
                                        <span className={paint}>{t(isWire ? 'speedWireTitle' : 'speedAchTitle')}</span>
                                    }
                                    body={<span className={paint}>{body}</span>}
                                    trailing={
                                        <>
                                            <span
                                                className={twMerge(
                                                    'text-body-s-semibold',
                                                    paint ?? 'text-foreground-primary'
                                                )}
                                            >
                                                {feeText(option)}
                                            </span>
                                            {isSelected && <Icon name="check" size={20} className={paint} />}
                                        </>
                                    }
                                />
                            </div>
                            {/* same-day is an option on ACH, so it shows only under it */}
                            {!isWire && isAch && achSameDay && (
                                <div className="flex flex-col gap-1 px-4 pt-1" data-testid="usd-speed-same-day">
                                    <Checkbox
                                        label={t('speedSameDayLabel', { fee: feeText(achSameDay) })}
                                        value={sameDay}
                                        onChange={(event) => {
                                            if (disabled) return
                                            setSameDay(event.target.checked)
                                            onSelect(event.target.checked ? 'ach_same_day' : 'ach')
                                        }}
                                    />
                                    <p className="text-body-xs text-foreground-secondary">{t('speedSameDayHelper')}</p>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
