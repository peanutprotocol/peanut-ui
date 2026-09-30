'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/0_Bruddle/Button'
import { Calendar } from '@/components/0_Bruddle/Calendar'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { type PickedDays } from '../statementPeriod.utils'

interface CustomPeriodDrawerProps {
    open: boolean
    /** the applied period: each opening starts from it */
    days: DateRange | undefined
    onApply: (days: PickedDays) => void
    /** swipe, overlay, back or Escape: nothing is applied */
    onClose: () => void
}

/**
 * Picks the days of a custom statement period. The calendar edits a draft, and
 * only Apply hands it to the page, so a drawer closed any other way leaves the
 * period as it was. Same head as the residence drawer (icon bubble, title, one
 * line of copy).
 */
export const CustomPeriodDrawer = ({ open, days, onApply, onClose }: CustomPeriodDrawerProps) => {
    const t = useTranslations('statements')
    const [draft, setDraft] = useState<DateRange | undefined>(days)
    const [opening, setOpening] = useState(0)

    // the page keeps the drawer mounted and toggles `open`, so a pick that was
    // never applied must not survive to the next opening. The calendar is keyed
    // by the opening, so it also returns to the applied period's month.
    useEffect(() => {
        if (!open) return
        setDraft(days)
        setOpening((count) => count + 1)
    }, [open, days])

    return (
        <Drawer
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 text-center">
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble {...CONCEPT_ICONS.period} />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('periods.custom')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col gap-3">
                        <p className="text-body-s">{t('customPeriod.description')}</p>
                        <Calendar key={opening} selected={draft} onSelect={setDraft} defaultMonth={draft?.from} />
                        {/* Apply sticks to the bottom of the scroll area: a six-week month
                            is taller than the sheet at 375x667. -mx-4/px-4 bleeds the
                            backdrop to the panel edges (the scroll area owns the L/16
                            inset). The bottom padding sits here, not on the column, because
                            a stuck footer ends at the scroll area's edge, 8px below the
                            screen. */}
                        <div className="sticky bottom-0 -mx-4 bg-background-default px-4 pt-3 pb-6">
                            <Button
                                variant="primary"
                                className="w-full"
                                disabled={!draft?.from}
                                onClick={() => draft?.from && onApply({ from: draft.from, to: draft.to })}
                            >
                                {t('customPeriod.apply')}
                            </Button>
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
