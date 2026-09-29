'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { twMerge } from '@/utils/tw'

interface HistoryFilterButtonProps {
    /** a timeframe is applied: the circle shows the selected tint */
    active: boolean
    label: string
    onClick: () => void
}

/**
 * Nav-circle filter button for the history header: 40px visual, 44px hit
 * area through the pseudo-element (board 17802:61534). An applied range
 * borrows the Tabs selected recipe — action-primary border plus the app's
 * 10% selected tint, glyph stays black. `not-active:` lets the secondary
 * button's own press state show through (law 7); a plain utility would
 * override it. No navigation-board row covers the applied state; flagged
 * in the PR body.
 */
export function HistoryFilterButton({ active, label, onClick }: HistoryFilterButtonProps) {
    return (
        <Button
            variant="secondary"
            className={twMerge(
                'relative size-10 w-10 p-0 shadow-none after:absolute after:-inset-0.5',
                active && 'border-action-primary not-active:bg-action-primary/10'
            )}
            aria-label={label}
            onClick={onClick}
            data-testid="history-filters"
        >
            <Icon name="list-filter" size={20} />
        </Button>
    )
}
