'use client'

import FacetChecklist from './FacetChecklist'
import InfoTooltip from './InfoTooltip'
import { FIXED_WINDOW_LABEL, TOP_NODES_OPTIONS } from './query'
import { edgeTypeFacets } from './selectors'
import type { EdgeDirectionFilter, ExplorerFilters, ExplorerRelationship, P2PEdgeType } from './types'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import BaseSelect from '@/components/0_Bruddle/BaseSelect'
import { Field } from '@/components/0_Bruddle/Field'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Tabs } from '@/components/0_Bruddle/Tabs'

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
        <aside
            className="min-h-0 overflow-y-auto border-b border-border-default bg-background-default p-4 lg:border-r lg:border-b-0"
            aria-label="Filters"
        >
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-heading-card">Filters</h2>
                <LinkButton onClick={onReset}>Reset</LinkButton>
            </div>

            <fieldset className="pb-3">
                <legend className="mb-2 flex items-center gap-1 text-label-m text-foreground-secondary uppercase">
                    Window
                    <InfoTooltip label="time window">
                        The backend aggregates payments over a fixed window. There is no time filter.
                    </InfoTooltip>
                </legend>
                <p className="text-body-xs text-foreground-secondary">{FIXED_WINDOW_LABEL}</p>
            </fieldset>

            <fieldset className="border-t border-border-subtle py-3">
                <legend className="mb-2 flex items-center gap-1 text-label-m text-foreground-secondary uppercase">
                    Top users
                    <InfoTooltip label="top users">
                        Server-side cap: top N users by points, plus recent signups. Changing it reloads the graph.
                    </InfoTooltip>
                </legend>
                <BaseSelect
                    value={String(filters.topNodes)}
                    onValueChange={(value) => onChange({ topNodes: Number(value) })}
                    aria-label="Top users"
                    options={TOP_NODES_OPTIONS.map((option) => ({
                        value: String(option),
                        label: option === 0 ? 'All users (slow)' : `Top ${option.toLocaleString()}`,
                    }))}
                />
            </fieldset>

            <FacetChecklist
                label="Payment type"
                tooltip="How the payment moved between the two users."
                facets={edgeTypeFacets(relationships)}
                selected={filters.types}
                onChange={(types) => onChange({ types: types as P2PEdgeType[] })}
            />

            <fieldset className="border-t border-border-subtle py-3">
                <legend className="mb-2 flex items-center gap-1 text-label-m text-foreground-secondary uppercase">
                    Direction
                    <InfoTooltip label="direction">
                        One row per payer, recipient and type. Both ways keeps every pair with any reverse payment; the
                        row badge says whether the same type comes back.
                    </InfoTooltip>
                </legend>
                <Tabs
                    variant="pill"
                    value={filters.direction}
                    onValueChange={(value) => onChange({ direction: value as EdgeDirectionFilter })}
                    tabs={(Object.keys(DIRECTION_LABELS) as EdgeDirectionFilter[]).map((option) => ({
                        value: option,
                        label: DIRECTION_LABELS[option],
                    }))}
                    aria-label="Direction"
                    fullWidth
                />
            </fieldset>

            <fieldset className="flex flex-col gap-2 border-t border-border-subtle py-3">
                <legend className="mb-2 text-label-m text-foreground-secondary uppercase">Minimums</legend>
                <Field label="Min transactions">
                    <BaseInput
                        type="number"
                        min={0}
                        step={1}
                        value={filters.minCount}
                        onChange={(event) => onChange({ minCount: Math.max(0, Number(event.target.value) || 0) })}
                        aria-label="Min transactions"
                    />
                </Field>
                <Field label="Min total USD">
                    <BaseInput
                        type="number"
                        min={0}
                        step={1}
                        value={filters.minUsd}
                        onChange={(event) => onChange({ minUsd: Math.max(0, Number(event.target.value) || 0) })}
                        aria-label="Min total USD"
                    />
                </Field>
            </fieldset>
        </aside>
    )
}
