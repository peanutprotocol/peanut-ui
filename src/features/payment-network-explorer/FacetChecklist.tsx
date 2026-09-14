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
            <legend className="mb-2 flex w-full items-center gap-1.5 text-xs font-bold tracking-wide text-grey-1 uppercase">
                {label}
                <InfoTooltip label={label}>{tooltip}</InfoTooltip>
                {selected.length > 0 && (
                    <button
                        type="button"
                        onClick={() => onChange([])}
                        className="ml-auto text-[11px] tracking-normal text-n-1 normal-case underline"
                    >
                        Clear
                    </button>
                )}
            </legend>
            {facets.length === 0 ? (
                <p className="text-xs text-grey-1">{emptyLabel}</p>
            ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
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
                                <span className="text-grey-1 tabular-nums">{facet.observedCount.toLocaleString()}</span>
                            </label>
                        )
                    })}
                </div>
            )}
        </fieldset>
    )
}
