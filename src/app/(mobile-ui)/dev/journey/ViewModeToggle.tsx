'use client'

import { twMerge } from 'tailwind-merge'
import type { JourneyViewMode } from './journeyTypes'

const OPTIONS: { value: JourneyViewMode; label: string; hint: string }[] = [
    { value: 'product', label: 'Product view', hint: 'Copy and flow only — no predicates, no file paths.' },
    { value: 'dev', label: 'Dev view', hint: 'Adds the gating predicates, source files and event types.' },
]

/** Segmented control switching the board between cockpit and source-of-truth reading. */
export default function ViewModeToggle({
    value,
    onChange,
}: {
    value: JourneyViewMode
    onChange: (next: JourneyViewMode) => void
}) {
    return (
        <div className="flex shrink-0 rounded-sm border border-n-1 bg-white p-0.5">
            {OPTIONS.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    title={option.hint}
                    aria-pressed={value === option.value}
                    onClick={() => onChange(option.value)}
                    className={twMerge(
                        'rounded-sm px-3 py-1.5 text-xs font-bold transition-colors',
                        value === option.value ? 'bg-primary-1 text-n-1' : 'text-grey-1 hover:bg-primary-3/40'
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}
