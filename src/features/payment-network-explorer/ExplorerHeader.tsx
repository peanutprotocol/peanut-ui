import SearchBox from './SearchBox'
import InfoTooltip from './InfoTooltip'
import type { ExplorerView } from './types'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import SegmentedControl from '@/components/0_Bruddle/SegmentedControl'

interface ExplorerHeaderProps {
    view: ExplorerView
    searching: boolean
    searchError: string | null
    onViewChange: (view: ExplorerView) => void
    onSearch: (username: string) => Promise<boolean>
}

export default function ExplorerHeader({ view, searching, searchError, onViewChange, onSearch }: ExplorerHeaderProps) {
    return (
        <header className="grid shrink-0 grid-cols-1 items-center gap-3 border-b border-border-default bg-background-default p-4 lg:min-h-16 lg:grid-cols-[minmax(240px,1fr)_minmax(280px,340px)_1fr] lg:gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="truncate text-heading-card">Payment Network Explorer</h1>
                <span className="text-label-m text-foreground-secondary">Live data</span>
                <InfoTooltip label="live data">
                    Reads the canonical payment ledger. This page keeps no data copy.
                </InfoTooltip>
            </div>
            <SearchBox busy={searching} error={searchError} onSearch={onSearch} />
            <div className="flex items-center justify-between gap-3 lg:justify-end">
                <SegmentedControl
                    value={view}
                    onChange={(value) => onViewChange(value as ExplorerView)}
                    options={[
                        { value: 'graph', label: 'Graph' },
                        { value: 'table', label: 'Table' },
                    ]}
                    aria-label="Explorer view"
                />
                {/* /home, not /dev: the /dev index is notFound() on peanut.me. */}
                <LinkButton onClick={() => window.location.assign('/home')}>Close</LinkButton>
            </div>
        </header>
    )
}
