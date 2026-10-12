'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { DayPicker, type DateRange } from 'react-day-picker'
import { es, ptBR } from 'react-day-picker/locale'
import { twMerge } from '@/utils/tw'
import { heavyImpactHaptic, impactHaptic } from '@/utils/haptics'
import { rangeBetween, selectableDay, selectableDayAt } from './calendar.utils'

interface CalendarProps {
    selected: DateRange | undefined
    onSelect: (range: DateRange | undefined) => void
    defaultMonth?: Date
    className?: string
}

const RANGE_ENDPOINT =
    'rounded-sm bg-background-selection inset-ring inset-ring-border-default text-foreground-over-color-primary'

interface Press {
    anchor: Date
    last: Date
    lastIso: string
    /** the pointer has entered a second day — this press is a drag, not a tap */
    dragging: boolean
}

/**
 * Range calendar over react-day-picker, styled with semantic tokens only.
 *
 * Tap: the first tap sets the start, the second sets the end (in either order —
 * the range always spans the two taps), and a tap on a finished range starts a
 * new one. Tapping a single-day range's own day clears it. This is
 * react-day-picker's `resetOnSelect`, the Material 3 date-range behaviour.
 *
 * Drag: press a day and slide across others; the range follows the pointer
 * live and commits on release, replacing any previous range.
 *
 * Haptics: a heavy tap on press and on the release that commits a drag, a light
 * tap for each new day the pointer crosses.
 *
 * Ordered for the activity download period (Aleks, 2026-09-15), now the
 * statement period on Profile → Statements. Day cells are 44px (touch-target
 * law). Future days are unselectable — activity can only exist in the past.
 *
 * Every month shows six week rows, so what sits under the calendar does not
 * move when the month changes.
 *
 * Selection follows design.md "selected list rows": the two picked days are
 * tiles (pale-blue fill + 1px inset ring), the days between take the fill alone.
 */
export const Calendar = ({ selected, onSelect, defaultMonth, className }: CalendarProps) => {
    const locale = useLocale()
    const dayPickerLocale = locale.startsWith('es') ? es : locale === 'pt-BR' ? ptBR : undefined
    const today = new Date()
    const focusRing = 'focus-visible:outline-[3px] focus-visible:outline-action-focus'

    // live range while a drag is in flight; the parent only sees committed ranges
    const [preview, setPreview] = useState<DateRange | undefined>(undefined)
    const press = useRef<Press | null>(null)
    // a drag that ends on the cell it started from also fires a click on that
    // cell; without this the click would restart the range the drag just set
    const swallowNextSelect = useRef(false)
    const detachRelease = useRef<(() => void) | null>(null)
    // release listeners live on window for the whole press — read the latest callback
    const onSelectRef = useRef(onSelect)
    onSelectRef.current = onSelect

    useEffect(() => () => detachRelease.current?.(), [])

    const shown = preview ?? selected
    // react-day-picker marks range_start only once both ends exist, so a
    // start-only range (the first tap) would render unhighlighted
    const anchor = shown?.from && !shown.to ? shown.from : undefined

    const endPress = (commit: boolean) => {
        detachRelease.current?.()
        detachRelease.current = null
        const current = press.current
        press.current = null
        if (!current?.dragging) return
        setPreview(undefined)
        if (!commit) return
        onSelectRef.current(rangeBetween(current.anchor, current.last))
        heavyImpactHaptic()
        swallowNextSelect.current = true
        // the trailing click, if any, is dispatched before this timer runs
        setTimeout(() => {
            swallowNextSelect.current = false
        }, 0)
    }

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // skip secondary mouse buttons (right/middle click)
        if (e.button > 0) return
        const hit = selectableDay((e.target as Element).closest<HTMLElement>('[data-day]'))
        if (!hit) return
        swallowNextSelect.current = false
        press.current = { anchor: hit.day, last: hit.day, lastIso: hit.iso, dragging: false }
        heavyImpactHaptic()
        // release can land outside the calendar, so listen on window
        const onUp = () => endPress(true)
        const onCancel = () => endPress(false)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onCancel)
        detachRelease.current = () => {
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', onCancel)
        }
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const current = press.current
        if (!current) return
        const hit = selectableDayAt(e.clientX, e.clientY)
        if (!hit || hit.iso === current.lastIso) return
        current.last = hit.day
        current.lastIso = hit.iso
        current.dragging = true
        setPreview(rangeBetween(current.anchor, hit.day))
        impactHaptic()
    }

    return (
        // data-vaul-no-drag: a drag across days must select, not pull the drawer down
        <div data-vaul-no-drag onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}>
            <DayPicker
                mode="range"
                resetOnSelect
                fixedWeeks
                selected={shown}
                modifiers={anchor ? { range_anchor: anchor } : undefined}
                modifiersClassNames={{ range_anchor: RANGE_ENDPOINT }}
                onSelect={(range) => {
                    if (swallowNextSelect.current) return
                    onSelect(range)
                }}
                defaultMonth={defaultMonth}
                locale={dayPickerLocale}
                disabled={{ after: today }}
                endMonth={today}
                classNames={{
                    root: twMerge('relative w-full select-none', className),
                    months: 'flex w-full flex-col',
                    month: 'w-full',
                    month_caption: 'flex h-10 items-center text-body-m-semibold text-foreground-primary',
                    // -right-2.5: a 20px arrow sits in a 40px button, so the button steps 10px into
                    // the page gutter and the arrow lines up with the right edge of the fields above
                    nav: 'absolute -right-2.5 top-0 flex h-10 items-center gap-1',
                    button_previous: twMerge(
                        'relative flex size-10 items-center justify-center rounded-sm text-foreground-primary transition-colors duration-instant hover:text-action-ghost-hover active:text-action-ghost-hover aria-disabled:opacity-40 after:absolute after:-inset-0.5',
                        focusRing
                    ),
                    button_next: twMerge(
                        'relative flex size-10 items-center justify-center rounded-sm text-foreground-primary transition-colors duration-instant hover:text-action-ghost-hover active:text-action-ghost-hover aria-disabled:opacity-40 after:absolute after:-inset-0.5',
                        focusRing
                    ),
                    chevron: 'size-5 fill-current',
                    // touch-none: a finger sliding over the grid selects days instead of
                    // scrolling the page; the rest of the calendar still scrolls
                    month_grid: 'mt-2 w-full border-collapse touch-none',
                    weekday: 'h-9 text-center text-body-xs text-foreground-secondary',
                    // h-11: a week row of another month has no buttons and would collapse without it
                    day: 'h-11 p-0 text-center',
                    day_button: twMerge(
                        'mx-auto flex size-11 items-center justify-center rounded-sm text-body-s transition-colors duration-instant disabled:cursor-default',
                        focusRing
                    ),
                    range_start: RANGE_ENDPOINT,
                    range_middle: 'bg-background-selection text-foreground-over-color-primary',
                    range_end: RANGE_ENDPOINT,
                    today: '[&>button]:text-body-s-semibold',
                    outside: 'text-foreground-secondary opacity-50',
                    disabled: 'text-foreground-secondary opacity-40',
                    hidden: 'invisible',
                }}
            />
        </div>
    )
}
