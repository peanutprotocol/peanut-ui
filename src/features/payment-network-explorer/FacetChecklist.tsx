import InfoTooltip from './InfoTooltip'
import type { ExplorerFacet } from './types'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'

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
        <fieldset className="border-t border-border-subtle py-3 first:border-t-0 first:pt-0">
            <legend className="mb-2 flex w-full items-center gap-1 text-label-m text-foreground-secondary uppercase">
                {label}
                <InfoTooltip label={label}>{tooltip}</InfoTooltip>
                {selected.length > 0 && (
                    <LinkButton onClick={() => onChange([])} className="ml-auto tracking-normal normal-case">
                        Clear
                    </LinkButton>
                )}
            </legend>
            {facets.length === 0 ? (
                <p className="text-body-xs text-foreground-secondary">{emptyLabel}</p>
            ) : (
                <div className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
                    {facets.map((facet) => {
                        const checked = selected.includes(facet.value)
                        return (
                            <Checkbox
                                key={facet.value}
                                value={checked}
                                onChange={() => toggle(facet.value)}
                                className="w-full"
                                label={
                                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                                        <span className="truncate" title={facet.label}>
                                            {facet.label}
                                        </span>
                                        <span className="text-foreground-secondary tabular-nums">
                                            {facet.observedCount.toLocaleString()}
                                        </span>
                                    </span>
                                }
                            />
                        )
                    })}
                </div>
            )}
        </fieldset>
    )
}
