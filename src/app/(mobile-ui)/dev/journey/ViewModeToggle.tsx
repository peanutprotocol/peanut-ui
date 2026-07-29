'use client'

import DevSegmented from '../_components/DevSegmented'
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
    return <DevSegmented value={value} options={OPTIONS} onChange={onChange} />
}
