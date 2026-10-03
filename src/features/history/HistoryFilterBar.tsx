'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import { SearchInput } from '@/components/SearchInput'
import { HISTORY_FILTERS, isHistoryFilter, type HistoryFilter } from './historyFilters.utils'

interface HistoryFilterBarProps {
    query: string
    onQueryChange: (query: string) => void
    filter: HistoryFilter
    onFilterChange: (filter: HistoryFilter) => void
}

const FADE = '1.5rem'

/** the edge fade, only on a side that has more pills behind it */
function fadeMask(left: boolean, right: boolean): string | undefined {
    if (!left && !right) return undefined
    const start = left ? `transparent, #000 ${FADE}` : '#000'
    const end = right ? `#000 calc(100% - ${FADE}), transparent` : '#000'
    return `linear-gradient(to right, ${start}, ${end})`
}

/** Search box over a triggers-only pill row: filters the Activity feed in place. */
export function HistoryFilterBar({ query, onQueryChange, filter, onFilterChange }: HistoryFilterBarProps) {
    const t = useTranslations('history')
    const pillsRef = useRef<HTMLDivElement>(null)
    const [overflow, setOverflow] = useState({ left: false, right: false })
    const hasCentered = useRef(false)

    // the pills scroll inside Tabs' own tablist; this reads it from the outside
    const tablist = () => pillsRef.current?.querySelector<HTMLElement>('[role="tablist"]') ?? null

    const measure = useCallback(() => {
        const list = tablist()
        if (!list) return
        const left = list.scrollLeft > 1
        const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 1
        setOverflow((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
    }, [])

    useEffect(() => {
        const list = tablist()
        if (!list) return
        measure()
        list.addEventListener('scroll', measure, { passive: true })
        const observer = new ResizeObserver(measure)
        observer.observe(list)
        return () => {
            list.removeEventListener('scroll', measure)
            observer.disconnect()
        }
    }, [measure])

    // keep the picked pill whole: centre it in the row. Jumps on first paint
    // (a `?type=` deep link), glides after that. Horizontal only, so the page
    // itself never scrolls.
    useEffect(() => {
        const list = tablist()
        const active = list?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
        if (!list || !active) return
        const listRect = list.getBoundingClientRect()
        const tabRect = active.getBoundingClientRect()
        const target = list.scrollLeft + tabRect.left - listRect.left - (listRect.width - tabRect.width) / 2
        list.scrollTo({ left: Math.max(0, target), behavior: hasCentered.current ? 'smooth' : 'auto' })
        hasCentered.current = true
    }, [filter])

    const mask = fadeMask(overflow.left, overflow.right)

    return (
        <div className="space-y-3" data-testid="history-filter-bar">
            <SearchInput
                value={query}
                onChange={onQueryChange}
                onClear={() => onQueryChange('')}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchLabel')}
                clearLabel={t('clearSearch')}
            />
            <div ref={pillsRef} style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}>
                <Tabs
                    aria-label={t('filterLabel')}
                    size="sm"
                    fullWidth="track"
                    value={filter}
                    onValueChange={(value) => onFilterChange(isHistoryFilter(value) ? value : 'all')}
                    tabs={HISTORY_FILTERS.map((value) => ({ value, label: t(`filter.${value}`) }))}
                />
            </div>
        </div>
    )
}
