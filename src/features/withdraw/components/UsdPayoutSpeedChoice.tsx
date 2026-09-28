'use client'

import { useEffect, useState } from 'react'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Section } from '@/components/0_Bruddle/Section'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { formatBankAmount } from '@/utils/currency'
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
 * How a USD withdrawal goes out (TASK-23054): ACH or wire, as contentless
 * value tabs with the fee in each label, so the price shows before the tap.
 * ACH is the default. Under the ACH tab, one toggle row asks for same-day ACH;
 * a wire has no sub-option. A wire that cannot be picked is a disabled tab
 * with one helper line that says why.
 */
export function UsdPayoutSpeedChoice({ options, selected, onSelect, disabled = false }: UsdPayoutSpeedChoiceProps) {
    const t = useTranslations('withdraw.bank')
    const isWire = selected === 'wire'
    // The same-day choice outlives a detour to wire: going back to ACH brings
    // back what the toggle said. Ephemeral UI state; the URL holds the rail.
    const [sameDay, setSameDay] = useState(selected === 'ach_same_day')
    useEffect(() => {
        if (selected !== 'wire') setSameDay(selected === 'ach_same_day')
    }, [selected])

    const ach = options.find((option) => option.speed === 'ach')
    const achSameDay = options.find((option) => option.speed === 'ach_same_day')
    const wire = options.find((option) => option.speed === 'wire')

    const tabFee = (option: UsdPayoutSpeedOption) =>
        Number(option.feeUsd) > 0 ? formatBankAmount(Number(option.feeUsd), 'USD') : t('speedTabFree')

    const wireHelper =
        wire?.block === 'belowMinimum'
            ? t('speedWireBelowMinimum', { amount: formatBankAmount(Number(wire.minimumUsd), 'USD') })
            : wire?.block === 'accountCannotTake'
              ? t('speedAccountCannotTake')
              : null

    const tabs = [
        ach && { value: 'ach', label: t('speedAchTab', { fee: tabFee(ach) }), disabled },
        wire && { value: 'wire', label: t('speedWireTab', { fee: tabFee(wire) }), disabled: disabled || !!wire.block },
    ].filter((tab) => !!tab)

    return (
        <Section title={t('sendByLabel')}>
            {tabs.length > 1 && (
                <div data-testid="usd-speed-tabs">
                    <Tabs
                        tabs={tabs}
                        aria-label={t('sendByLabel')}
                        fullWidth="stretch"
                        value={isWire ? 'wire' : 'ach'}
                        onValueChange={(value) =>
                            onSelect(value === 'wire' ? 'wire' : sameDay && achSameDay ? 'ach_same_day' : 'ach')
                        }
                    />
                </div>
            )}
            {wireHelper && <p className="text-body-xs text-foreground-secondary">{wireHelper}</p>}
            {/* same day is an option on ACH, so it shows only under it */}
            {!isWire && achSameDay && (
                <ListItem
                    position="solo"
                    className="w-full"
                    title={t('speedSameDayTitle')}
                    body={t('speedSameDayHelper')}
                    bodyWrap
                    trailing={
                        <Toggle
                            checked={sameDay}
                            disabled={disabled}
                            onChange={(checked) => {
                                setSameDay(checked)
                                onSelect(checked ? 'ach_same_day' : 'ach')
                            }}
                            aria-label={t('speedSameDayTitle')}
                            data-testid="usd-speed-same-day"
                        />
                    }
                />
            )}
        </Section>
    )
}
