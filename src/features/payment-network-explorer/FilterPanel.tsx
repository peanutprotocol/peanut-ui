'use client'

/* eslint-disable react/jsx-no-literals -- internal team tool copy is intentionally not localized */

import FacetChecklist from './FacetChecklist'
import InfoTooltip from './InfoTooltip'
import { fromDateTimeLocal, toDateTimeLocal } from './query'
import {
    MOVEMENT_STATES,
    RANGE_PRESETS,
    type ExplorerFacets,
    type ExplorerFilters,
    type MovementState,
    type RangePreset,
} from './types'

interface FilterPanelProps {
    filters: ExplorerFilters
    facets: ExplorerFacets | null
    onChange: (patch: Partial<ExplorerFilters>) => void
    onReset: () => void
}

const STATE_LABELS: Record<MovementState, string> = {
    SETTLED: 'Settled',
    PENDING: 'Pending',
    FAILED: 'Failed',
    REFUNDED: 'Refunded',
    REVERSED: 'Reversed',
}

export default function FilterPanel({ filters, facets, onChange, onReset }: FilterPanelProps) {
    const setRange = (range: RangePreset) => {
        if (range === 'custom' && (!filters.customFrom || !filters.customTo)) {
            const to = new Date()
            const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
            onChange({ range, customFrom: from.toISOString(), customTo: to.toISOString() })
            return
        }
        onChange({ range })
    }
    const toggleState = (state: MovementState) => {
        const states = filters.states.includes(state)
            ? filters.states.filter((item) => item !== state)
            : [...filters.states, state]
        onChange({ states: states.length > 0 ? states : ['SETTLED'] })
    }

    return (
        <aside className="min-h-0 overflow-y-auto border-r border-n-1 bg-white px-3 py-4" aria-label="Filters">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold">Filters</h2>
                <button type="button" onClick={onReset} className="text-xs font-semibold underline">
                    Reset
                </button>
            </div>

            <fieldset className="pb-3">
                <legend className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-grey-1">
                    Time
                    <InfoTooltip label="time window">
                        UTC event time. Custom windows span 24 hours to 120 days.
                    </InfoTooltip>
                </legend>
                <div className="grid grid-cols-3 gap-1">
                    {RANGE_PRESETS.filter((preset) => preset !== 'custom').map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => setRange(preset)}
                            aria-pressed={filters.range === preset}
                            className={`rounded-sm border border-n-1 px-1 py-1.5 text-xs font-semibold ${
                                filters.range === preset ? 'bg-primary-3 shadow-[1px_1px_0_#000]' : 'bg-white'
                            }`}
                        >
                            {preset}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setRange('custom')}
                        aria-pressed={filters.range === 'custom'}
                        className={`rounded-sm border border-n-1 px-1 py-1.5 text-xs font-semibold ${
                            filters.range === 'custom' ? 'bg-primary-3 shadow-[1px_1px_0_#000]' : 'bg-white'
                        }`}
                    >
                        Custom
                    </button>
                </div>
                {filters.range === 'custom' && (
                    <div className="mt-2 space-y-2">
                        <label className="block text-[11px] font-semibold text-grey-1">
                            From UTC
                            <input
                                type="datetime-local"
                                value={toDateTimeLocal(filters.customFrom)}
                                onChange={(event) => onChange({ customFrom: fromDateTimeLocal(event.target.value) })}
                                className="mt-1 h-8 w-full rounded-sm border border-n-1 bg-white px-2 text-xs text-n-1"
                            />
                        </label>
                        <label className="block text-[11px] font-semibold text-grey-1">
                            To UTC
                            <input
                                type="datetime-local"
                                value={toDateTimeLocal(filters.customTo)}
                                onChange={(event) => onChange({ customTo: fromDateTimeLocal(event.target.value) })}
                                className="mt-1 h-8 w-full rounded-sm border border-n-1 bg-white px-2 text-xs text-n-1"
                            />
                        </label>
                    </div>
                )}
            </fieldset>

            <fieldset className="border-t border-n-1/15 py-3">
                <legend className="mb-2 flex w-full items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-grey-1">
                    Movement state
                    <InfoTooltip label="movement state">
                        Settled is the trustworthy baseline. Other states are overlays.
                    </InfoTooltip>
                </legend>
                <div className="space-y-1.5">
                    {MOVEMENT_STATES.map((state) => (
                        <label key={state} className="flex cursor-pointer items-center gap-2 text-xs">
                            <input
                                type="checkbox"
                                checked={filters.states.includes(state)}
                                onChange={() => toggleState(state)}
                                className="size-3.5 rounded border-n-1 accent-black"
                            />
                            <span>{STATE_LABELS[state]}</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <FacetChecklist
                label="Rail"
                tooltip="Canonical path used to move value. Configured rails remain visible even at zero observations."
                facets={facets?.rails ?? []}
                selected={filters.rails}
                onChange={(rails) => onChange({ rails })}
            />
            <FacetChecklist
                label="Method"
                tooltip="Customer-facing payment method, independent from provider."
                facets={facets?.methods ?? []}
                selected={filters.methods}
                onChange={(methods) => onChange({ methods })}
            />
            <FacetChecklist
                label="Provider"
                tooltip="Provider recorded on the canonical movement or status event."
                facets={facets?.providers ?? []}
                selected={filters.providers}
                onChange={(providers) => onChange({ providers })}
            />

            <details className="border-t border-n-1/15 pt-3">
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-grey-1">
                    More filters
                </summary>
                <div className="pt-3">
                    <FacetChecklist
                        label="Kind"
                        tooltip="Canonical event kind used by the server classification."
                        facets={facets?.kinds ?? []}
                        selected={filters.kinds}
                        onChange={(kinds) => onChange({ kinds })}
                    />
                    <FacetChecklist
                        label="Asset"
                        tooltip="Native asset buckets only. The explorer never combines currencies."
                        facets={facets?.assets ?? []}
                        selected={filters.assets}
                        onChange={(assets) => onChange({ assets })}
                    />
                    <FacetChecklist
                        label="Chain"
                        tooltip="Execution chain attached to the movement asset."
                        facets={facets?.chains ?? []}
                        selected={filters.chains}
                        onChange={(chains) => onChange({ chains })}
                    />
                    <FacetChecklist
                        label="Direction"
                        tooltip="Incoming, outgoing, or internal movement direction."
                        facets={facets?.directions ?? []}
                        selected={filters.directions}
                        onChange={(directions) => onChange({ directions: directions as ExplorerFilters['directions'] })}
                    />
                </div>
            </details>

            <fieldset className="mt-3 border-t border-n-1/15 pt-3">
                <legend className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-grey-1">
                    Infrastructure
                    <InfoTooltip label="infrastructure">
                        Provider and rail hubs are optional topology nodes.
                    </InfoTooltip>
                </legend>
                <div className="grid grid-cols-2 rounded-sm border border-n-1 bg-[#f3efe9] p-0.5">
                    {(['edges', 'hubs'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => onChange({ infrastructure: mode })}
                            aria-pressed={filters.infrastructure === mode}
                            className={`rounded-[2px] px-2 py-1 text-xs font-bold capitalize ${
                                filters.infrastructure === mode ? 'bg-white shadow-sm' : 'text-grey-1'
                            }`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </fieldset>
        </aside>
    )
}
