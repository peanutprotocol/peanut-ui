'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { DateRange } from 'react-day-picker'
import { BaseSelect } from '@/components/0_Bruddle/BaseSelect'
import { Button } from '@/components/0_Bruddle/Button'
import { Calendar } from '@/components/0_Bruddle/Calendar'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useHistoryRange } from '@/hooks/useHistoryRange'
import {
    HISTORY_RANGE_PRESETS,
    startOfLocalDay,
    toLocalDateString,
    type HistoryRangePreset,
} from '@/utils/historyRange.utils'

interface HistoryRangeDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Set when opened from inside another drawer (the export drawer). */
    nested?: boolean
}

const CUSTOM = 'custom'

/**
 * Timeframe picker for the activity history. Mirrors the residence-change
 * surface (Profile/views/ResidenceChangeDrawer): centered icon bubble, title,
 * one select, one Save. Picking "Custom range" reveals the calendar below the
 * select; Save applies whichever of the two is in play.
 */
export const HistoryRangeDrawer = ({ open, onOpenChange, nested }: HistoryRangeDrawerProps) => {
    const t = useTranslations('history')
    const tCommon = useTranslations('common')
    const { activePreset, from, to, setPreset, setCustom } = useHistoryRange()
    const [selected, setSelected] = useState<string>(activePreset ?? CUSTOM)
    const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined)

    // The page keeps this mounted and toggles `open`, so re-seed the draft from
    // the URL each time it opens instead of trusting first-mount state.
    useEffect(() => {
        if (!open) return
        setSelected(activePreset ?? CUSTOM)
        setDraftRange(from && to ? { from: startOfLocalDay(from), to: startOfLocalDay(to) } : undefined)
    }, [open, activePreset, from, to])

    const options = useMemo(
        () => [
            ...HISTORY_RANGE_PRESETS.map((preset) => ({ value: preset, label: t(`range.${preset}`) })),
            { value: CUSTOM, label: t('range.custom') },
        ],
        [t]
    )

    const isCustom = selected === CUSTOM
    const save = () => {
        if (isCustom) {
            if (!draftRange?.from) return
            setCustom(toLocalDateString(draftRange.from), toLocalDateString(draftRange.to ?? draftRange.from))
        } else {
            setPreset(selected as HistoryRangePreset)
        }
        onOpenChange(false)
    }

    return (
        <Drawer nested={nested} open={open} onOpenChange={onOpenChange}>
            <DrawerContent accessibleTitle={t('range.title')}>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="calendar" className="bg-action-primary" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('range.title')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col gap-3 text-center">
                        <p className="text-body-s">{t('range.description')}</p>
                        <BaseSelect
                            options={options}
                            value={selected}
                            onValueChange={setSelected}
                            aria-label={t('range.title')}
                        />
                        {isCustom && (
                            <Calendar selected={draftRange} onSelect={setDraftRange} defaultMonth={draftRange?.from} />
                        )}
                        <Button
                            variant="purple"
                            shadowSize="4"
                            className="mt-1 w-full justify-center"
                            disabled={isCustom && !draftRange?.from}
                            onClick={save}
                        >
                            {tCommon('save')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
