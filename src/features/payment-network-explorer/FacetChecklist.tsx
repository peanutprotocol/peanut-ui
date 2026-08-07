/* eslint-disable react/jsx-no-literals -- internal team tool copy is intentionally not localized */
import InfoTooltip from './InfoTooltip'
import type { ExplorerFacet } from './types'

interface FacetChecklistProps {
    label: string
    tooltip: string
    facets: readonly ExplorerFacet[]
    selected: readonly string[]
    onChange: (values: string[]) => void
    emptyLabel?: string
}

export default function FacetChecklist({
    label,
    tooltip,
    facets,
    selected,
    onChange,
    emptyLabel = 'No values observed',
}: FacetChecklistProps) {
    const toggle = (value: string) => {
        onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])
    }

    return (
        <fieldset className="border-t border-n-1/15 py-3 first:border-t-0 first:pt-0">
            <legend className="mb-2 flex w-full items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-grey-1">
                {label}
                <InfoTooltip label={label}>{tooltip}</InfoTooltip>
                {selected.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onChange([])}
                        className="ml-auto text-[11px] normal-case tracking-normal text-n-1 underline"
                    >
                        Clear
                    </button>
                )}
            </legend>
            {facets.length === 0 ? (
                <p className="text-xs text-grey-1">{emptyLabel}</p>
            ) : (
                <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                    {facets.map((facet) => {
                        const checked = selected.includes(facet.value)
                        return (
                            <label
                                key={facet.value}
                                className={`flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-xs ${
                                    checked ? 'bg-primary-3/35 font-semibold' : 'hover:bg-[#f3efe9]'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggle(facet.value)}
                                    className="size-3.5 rounded border-n-1 accent-black"
                                />
                                <span className="min-w-0 flex-1 truncate" title={facet.label}>
                                    {facet.label}
                                </span>
                                <span className="tabular-nums text-grey-1">{facet.observedCount.toLocaleString()}</span>
                                {facet.configured && facet.isActive && facet.observedCount === 0 ? (
                                    <span
                                        className="rounded-full border border-[#2a9d55] px-1.5 py-0.5 text-[9px] font-bold text-[#1f6f50]"
                                        title="Active in the live registry; no observations in this window"
                                        aria-label="Active in the live registry; no observations in this window"
                                    >
                                        live
                                    </span>
                                ) : null}
                                {facet.configured && !facet.isActive ? (
                                    <span
                                        className="rounded-full border border-grey-1 px-1.5 py-0.5 text-[9px] font-bold text-grey-1"
                                        title="Inactive in the live registry; historical observations remain selectable"
                                        aria-label="Inactive in the live registry; historical observations remain selectable"
                                    >
                                        inactive
                                    </span>
                                ) : null}
                            </label>
                        )
                    })}
                </div>
            )}
        </fieldset>
    )
}
