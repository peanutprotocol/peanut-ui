'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { getCardPosition } from '@/components/Global/Card/card.utils'
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
 * Same-day ACH or wire for a USD withdrawal (TASK-23054). Each row states its
 * arrival and its fee before anything is confirmed; a wire that cannot be
 * picked says why. Selected rows follow design.md "selected list rows": the
 * fill and a trailing check, with the option semantics on a wrapper because
 * ListItem forwards no role.
 */
export function UsdPayoutSpeedChoice({ options, selected, onSelect, disabled = false }: UsdPayoutSpeedChoiceProps) {
    const t = useTranslations('withdraw.bank')

    return (
        <div className="flex flex-col gap-2">
            <MiniHeader>{t('speedLabel')}</MiniHeader>
            <div role="radiogroup" aria-label={t('speedLabel')} className="flex flex-col">
                {options.map((option, index) => {
                    const isSelected = option.speed === selected
                    const isBlocked = !!option.block
                    const canPick = !disabled && !isBlocked
                    const paint = isSelected ? 'text-foreground-over-color-primary' : undefined
                    const fee =
                        Number(option.feeUsd) > 0
                            ? t('speedFee', { fee: formatBankAmount(Number(option.feeUsd), 'USD') })
                            : t('speedFree')
                    const body =
                        option.block === 'belowMinimum'
                            ? t('speedBelowMinimum', { amount: formatBankAmount(Number(option.minimumUsd), 'USD') })
                            : option.block === 'accountCannotTake'
                              ? t('speedAccountCannotTake')
                              : t(option.speed === 'wire' ? 'speedWireBody' : 'speedAchBody')
                    return (
                        <div
                            key={option.speed}
                            role="radio"
                            aria-checked={isSelected}
                            aria-disabled={!canPick || undefined}
                            tabIndex={canPick ? 0 : -1}
                            onClick={canPick ? () => onSelect(option.speed) : undefined}
                            onKeyDown={(event) => {
                                if (!canPick || (event.key !== 'Enter' && event.key !== ' ')) return
                                event.preventDefault()
                                onSelect(option.speed)
                            }}
                            data-testid={`usd-speed-${option.speed}`}
                            className={twMerge(
                                'focus-visible:outline-[3px] focus-visible:outline-action-focus',
                                canPick && 'cursor-pointer'
                            )}
                        >
                            <ListItem
                                position={getCardPosition(index, options.length)}
                                disabled={isBlocked}
                                className={twMerge(
                                    'transition-colors duration-instant',
                                    isSelected && 'bg-action-primary'
                                )}
                                title={
                                    <span className={paint}>
                                        {t(option.speed === 'wire' ? 'speedWireTitle' : 'speedAchTitle')}
                                    </span>
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
                                            {fee}
                                        </span>
                                        {isSelected && <Icon name="check" size={20} className={paint} />}
                                    </>
                                }
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
