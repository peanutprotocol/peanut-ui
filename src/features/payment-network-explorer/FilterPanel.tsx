'use client'

import FacetChecklist from './FacetChecklist'
import InfoTooltip from './InfoTooltip'
import { FIXED_WINDOW_LABEL, TOP_NODES_OPTIONS } from './query'
import { edgeTypeFacets } from './selectors'
import type { EdgeDirectionFilter, ExplorerFilters, ExplorerRelationship, P2PEdgeType } from './types'

interface FilterPanelProps {
    filters: ExplorerFilters
    relationships: readonly ExplorerRelationship[]
    onChange: (patch: Partial<ExplorerFilters>) => void
    onReset: () => void
}

const DIRECTION_LABELS: Record<EdgeDirectionFilter, string> = {
    all: 'All',
    oneWay: 'One-way',
    bidirectional: 'Both ways',
}

export default function FilterPanel({ filters, relationships, onChange, onReset }: FilterPanelProps) {
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
                    Window
                    <InfoTooltip label="time window">
                        The backend aggregates payments over a fixed window. There is no time filter.
                    </InfoTooltip>
                </legend>
                <p className="rounded-sm border border-n-1/20 bg-[#f3efe9] px-2 py-1.5 text-xs">{FIXED_WINDOW_LABEL}</p>
            </fieldset>

            <fieldset className="border-t border-n-1/15 py-3">
                <legend className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-grey-1">
                    Top users
                    <InfoTooltip label="top users">
                        Server-side cap: top N users by points, plus recent signups. Changing it reloads the graph.
                    </InfoTooltip>
                </legend>
                <select
                    value={filters.topNodes}
                    onChange={(event) => onChange({ topNodes: Number(event.target.value) })}
                    aria-label="Top users"
                    className="h-8 w-full rounded-sm border border-n-1 bg-white px-2 text-xs"
                >
                    {TOP_NODES_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                            {option === 0 ? 'All users (slow)' : `Top ${option.toLocaleString()}`}
                        </option>
                    ))}
                </select>
            </fieldset>

            <FacetChecklist
                label="Payment type"
                tooltip="How the payment moved between the two users."
                facets={edgeTypeFacets(relationships)}
                selected={filters.types}
                onChange={(types) => onChange({ types: types as P2PEdgeType[] })}
            />

            <fieldset className="border-t border-n-1/15 py-3">
                <legend className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-grey-1">
                    Direction
                    <InfoTooltip label="direction">
                        Edges are directed payer to recipient. Both ways keeps pairs where any reverse payment exists.
                    </InfoTooltip>
                </legend>
                <div className="grid grid-cols-3 rounded-sm border border-n-1 bg-[#f3efe9] p-0.5">
                    {(Object.keys(DIRECTION_LABELS) as EdgeDirectionFilter[]).map((option) => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => onChange({ direction: option })}
                            aria-pressed={filters.direction === option}
                            className={`rounded-[2px] px-1 py-1 text-xs font-bold ${
                                filters.direction === option ? 'bg-white shadow-sm' : 'text-grey-1'
                            }`}
                        >
                            {DIRECTION_LABELS[option]}
                        </button>
                    ))}
                </div>
            </fieldset>

            <fieldset className="border-t border-n-1/15 py-3">
                <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-grey-1">Minimums</legend>
                <label className="block text-[11px] font-semibold text-grey-1">
                    Min transactions
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={filters.minCount}
                        onChange={(event) => onChange({ minCount: Math.max(0, Number(event.target.value) || 0) })}
                        className="mt-1 h-8 w-full rounded-sm border border-n-1 bg-white px-2 text-xs text-n-1"
                    />
                </label>
                <label className="mt-2 block text-[11px] font-semibold text-grey-1">
                    Min total USD
                    <input
                        type="number"
                        min={0}
                        step={1}
                        value={filters.minUsd}
                        onChange={(event) => onChange({ minUsd: Math.max(0, Number(event.target.value) || 0) })}
                        className="mt-1 h-8 w-full rounded-sm border border-n-1 bg-white px-2 text-xs text-n-1"
                    />
                </label>
            </fieldset>
        </aside>
    )
}
