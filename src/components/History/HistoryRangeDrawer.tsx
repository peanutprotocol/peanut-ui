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
    presetDates,
    rangeAnalytics,
    startOfLocalDay,
    toLocalDateString,
    type HistoryRangePreset,
} from '@/utils/historyRange.utils'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import posthog from 'posthog-js'

interface HistoryRangeDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Set when opened from inside another drawer (the export drawer). */
    nested?: boolean
    /** Renders the secondary Download button under Save. Left unset on the
     *  instance nested in the export drawer, which is already the download. */
    onDownload?: () => void
}

const CUSTOM = 'custom'

/**
 * Timeframe picker for the activity history. Mirrors the residence-change
 * surface (Profile/views/ResidenceChangeDrawer): centered icon bubble, title,
 * one select, one Save, plus a stroke Download under it. Picking "Custom range"
 * reveals the calendar below the select; Save applies whichever of the two is
 * in play. Download does not apply an unsaved pick — the export drawer shows
 * the applied range and changes it itself.
 */
export const HistoryRangeDrawer = ({ open, onOpenChange, nested, onDownload }: HistoryRangeDrawerProps) => {
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
        let applied: Parameters<typeof rangeAnalytics>[0]
        if (isCustom) {
            if (!draftRange?.from) return
            const from = toLocalDateString(draftRange.from)
            const to = toLocalDateString(draftRange.to ?? draftRange.from)
            setCustom(from, to)
            applied = { from, to }
        } else {
            const preset = selected as HistoryRangePreset
            setPreset(preset)
            applied = { activePreset: preset, ...(presetDates(preset) ?? {}) }
        }
        posthog.capture(ANALYTICS_EVENTS.ACTIVITY_RANGE_APPLIED, {
            ...rangeAnalytics(applied),
            // where the pick came from: the history header, or the export sheet
            source: nested ? 'export' : 'history',
        })
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
                        {/* An open calendar is taller than the sheet at 375x667, which
                            left Save under the fold. The CTAs stick to the bottom of the
                            drawer's scroll area instead. -mx-4/px-4 bleeds the backdrop to
                            the panel edges, since the scroll area owns the L/16 inset. The
                            DS has no drawer-footer recipe — flagged in the PR body. */}
                        <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 bg-background-default px-4 pt-3">
                            <Button
                                variant="purple"
                                shadowSize="4"
                                className="w-full justify-center"
                                disabled={isCustom && !draftRange?.from}
                                onClick={save}
                            >
                                {tCommon('save')}
                            </Button>
                            {onDownload && (
                                <Button variant="stroke" className="w-full justify-center" onClick={onDownload}>
                                    {t('export.download')}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
