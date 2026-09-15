'use client'

import { useLocale } from 'next-intl'
import { DayPicker, type DateRange } from 'react-day-picker'
import { es, ptBR } from 'react-day-picker/locale'
import { twMerge } from '@/utils/tw'

interface CalendarProps {
    selected: DateRange | undefined
    onSelect: (range: DateRange | undefined) => void
    defaultMonth?: Date
    className?: string
}

/**
 * Range calendar over react-day-picker, styled with semantic tokens only.
 *
 * code-only ❓ — no figma board yet (law 6): the primitive was ordered for the
 * activity-history timeframe filter (Aleks, 2026-09-15); a board is owed via
 * the figma-first flow. Day cells are 44px (touch-target law). Future days are
 * unselectable — activity can only exist in the past.
 */
export const Calendar = ({ selected, onSelect, defaultMonth, className }: CalendarProps) => {
    const locale = useLocale()
    const dayPickerLocale = locale.startsWith('es') ? es : locale === 'pt-BR' ? ptBR : undefined
    const today = new Date()
    const focusRing = 'focus-visible:outline-[3px] focus-visible:outline-action-focus'
    return (
        <DayPicker
            mode="range"
            selected={selected}
            onSelect={onSelect}
            defaultMonth={defaultMonth}
            locale={dayPickerLocale}
            disabled={{ after: today }}
            endMonth={today}
            classNames={{
                root: twMerge('relative w-full select-none', className),
                months: 'flex w-full flex-col',
                month: 'w-full',
                month_caption: 'flex h-10 items-center px-1 text-body-m-semibold text-foreground-primary',
                nav: 'absolute right-0 top-0 flex h-10 items-center gap-1',
                button_previous: twMerge(
                    'flex size-10 items-center justify-center rounded-sm text-foreground-primary transition-colors duration-instant hover:bg-background-disabled disabled:opacity-40',
                    focusRing
                ),
                button_next: twMerge(
                    'flex size-10 items-center justify-center rounded-sm text-foreground-primary transition-colors duration-instant hover:bg-background-disabled disabled:opacity-40',
                    focusRing
                ),
                chevron: 'size-5 fill-current',
                month_grid: 'mt-2 w-full border-collapse',
                weekday: 'h-9 text-center text-label-m font-normal text-foreground-secondary',
                day: 'p-0 text-center',
                day_button: twMerge(
                    'mx-auto flex size-11 items-center justify-center rounded-sm text-body-s transition-colors duration-instant disabled:cursor-default',
                    focusRing
                ),
                range_start: 'rounded-sm bg-action-primary text-foreground-primary',
                range_middle: 'bg-action-primary/10',
                range_end: 'rounded-sm bg-action-primary text-foreground-primary',
                today: 'font-bold',
                outside: 'text-foreground-secondary opacity-50',
                disabled: 'text-foreground-secondary opacity-40',
                hidden: 'invisible',
            }}
        />
    )
}
