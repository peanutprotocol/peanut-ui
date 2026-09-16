'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { SearchInput } from '@/components/SearchInput'

interface HistorySearchBarProps {
    /** opens the date-filter drawer */
    onOpenFilters: () => void
    /** a date range is applied — the filter button carries the active tint */
    isFilterActive: boolean
}

/**
 * Search field plus the filter entry point above the activity list.
 *
 * The search half is UI only for now — the query stays in local state and
 * filters nothing. When it gets wired it moves to nuqs like every other
 * filter (URL-as-state), so the query survives refresh and is shareable.
 */
export const HistorySearchBar = ({ onOpenFilters, isFilterActive }: HistorySearchBarProps) => {
    const t = useTranslations('history')
    const [query, setQuery] = useState('')

    return (
        <div className="flex w-full items-center gap-2">
            <SearchInput
                className="flex-1"
                value={query}
                onChange={setQuery}
                onClear={() => setQuery('')}
                placeholder={t('search.placeholder')}
                aria-label={t('search.placeholder')}
            />
            {/* bubble in a button, as in Global/TokenSelector NetworkButton. The
                40px box keeps the touch target while the S bubble (32px) stays
                level with the 40px field; an applied range turns it brand-pink,
                the same override the residence bubble uses. */}
            <Button
                variant="transparent"
                onClick={onOpenFilters}
                aria-label={t('range.title')}
                data-testid="history-filters"
                className="relative size-10 w-10 shrink-0 p-0 shadow-none after:absolute after:-inset-0.5"
            >
                <IconBubble icon="list-filter" size="s" className={isFilterActive ? 'bg-action-primary' : undefined} />
            </Button>
        </div>
    )
}
