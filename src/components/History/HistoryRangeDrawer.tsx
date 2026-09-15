'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/0_Bruddle/Button'
import { Calendar } from '@/components/0_Bruddle/Calendar'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { useHistoryRange } from '@/hooks/useHistoryRange'
import { HISTORY_RANGE_PRESETS, startOfLocalDay, toLocalDateString } from '@/utils/historyRange.utils'

interface HistoryRangeDrawerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Set when opened from inside another drawer (the export drawer). */
    nested?: boolean
}

/**
 * Timeframe picker for the activity history: preset rows plus a custom
 * calendar view. One drawer with two views — swapping content instead of
 * stacking a third drawer keeps vaul's nesting at its supported depth.
 */
export const HistoryRangeDrawer = ({ open, onOpenChange, nested }: HistoryRangeDrawerProps) => {
    const t = useTranslations('history')
    const tCommon = useTranslations('common')
    const { activePreset, from, to, setPreset, setCustom } = useHistoryRange()
    const [view, setView] = useState<'presets' | 'custom'>('presets')
    const [draft, setDraft] = useState<DateRange | undefined>(undefined)

    const handleOpenChange = (next: boolean) => {
        if (!next) setView('presets')
        onOpenChange(next)
    }

    const openCustom = () => {
        setDraft(from && to ? { from: startOfLocalDay(from), to: startOfLocalDay(to) } : undefined)
        setView('custom')
    }

    const applyDraft = () => {
        if (!draft?.from) return
        setCustom(toLocalDateString(draft.from), toLocalDateString(draft.to ?? draft.from))
        handleOpenChange(false)
    }

    // A range is active but matches no preset — the custom row owns the check.
    const isCustomActive = Boolean(from) && activePreset === undefined

    return (
        <Drawer nested={nested} open={open} onOpenChange={handleOpenChange}>
            <DrawerContent accessibleTitle={t('range.title')} className="py-4">
                {view === 'presets' ? (
                    <div className="flex flex-col gap-4 pb-2">
                        <div className="text-center text-heading-xs">{t('range.title')}</div>
                        <div className="flex flex-col">
                            {HISTORY_RANGE_PRESETS.map((preset, index) => (
                                <ListItem
                                    key={preset}
                                    position={getCardPosition(index, HISTORY_RANGE_PRESETS.length + 1)}
                                    title={t(`range.${preset}`)}
                                    trailing={activePreset === preset ? <Icon name="check" size={20} /> : undefined}
                                    onClick={() => {
                                        setPreset(preset)
                                        handleOpenChange(false)
                                    }}
                                />
                            ))}
                            <ListItem
                                position="last"
                                title={t('range.custom')}
                                trailing={isCustomActive ? <Icon name="check" size={20} /> : undefined}
                                chevron
                                onClick={openCustom}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 pb-2">
                        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center">
                            {/* nav circle recipe (board 17802:61534): 40px visual, pseudo-element to 44px */}
                            <Button
                                variant="stroke"
                                className="relative size-10 w-10 p-0 shadow-none after:absolute after:-inset-0.5"
                                aria-label={tCommon('back')}
                                onClick={() => setView('presets')}
                            >
                                <Icon name="chevron-up" size={20} className="-rotate-90" />
                            </Button>
                            <div className="text-center text-heading-xs">{t('range.customTitle')}</div>
                        </div>
                        <Calendar selected={draft} onSelect={setDraft} defaultMonth={draft?.from} />
                        <Button variant="purple" className="w-full" disabled={!draft?.from} onClick={applyDraft}>
                            {t('range.apply')}
                        </Button>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    )
}
