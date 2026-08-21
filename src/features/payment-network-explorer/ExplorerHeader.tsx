import SearchBox from './SearchBox'
import InfoTooltip from './InfoTooltip'
import type { ExplorerView } from './types'

interface ExplorerHeaderProps {
    view: ExplorerView
    searching: boolean
    searchError: string | null
    onViewChange: (view: ExplorerView) => void
    onSearch: (username: string) => Promise<boolean>
}

export default function ExplorerHeader({ view, searching, searchError, onViewChange, onSearch }: ExplorerHeaderProps) {
    return (
        <header className="grid h-16 shrink-0 grid-cols-[minmax(240px,1fr)_minmax(280px,340px)_1fr] items-center gap-4 border-b border-n-1 bg-white px-5">
            <div className="flex min-w-0 items-center gap-3">
                <h1 className="truncate text-lg font-bold">Payment Network Explorer</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-n-1 bg-green-1 px-2 py-0.5 text-[11px] font-bold">
                    <span className="size-1.5 rounded-full bg-[#237a43]" aria-hidden="true" />
                    Live
                </span>
                <InfoTooltip label="live data">
                    Reads the canonical payment ledger. This page keeps no data copy.
                </InfoTooltip>
            </div>
            <SearchBox busy={searching} error={searchError} onSearch={onSearch} />
            <div className="flex items-center justify-end gap-3">
                <div
                    role="group"
                    className="inline-flex rounded-sm border border-n-1 bg-[#f3efe9] p-0.5"
                    aria-label="Explorer view"
                >
                    {(['graph', 'table'] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={view === option}
                            onClick={() => onViewChange(option)}
                            className={`rounded-[2px] px-3 py-1 text-xs font-bold capitalize ${view === option ? 'bg-white shadow-sm' : 'text-grey-1'}`}
                        >
                            {option}
                        </button>
                    ))}
                </div>
                {/* /home, not /dev: the /dev index is notFound() on peanut.me. */}
                <button
                    type="button"
                    onClick={() => window.location.assign('/home')}
                    className="text-sm font-bold underline"
                >
                    Close
                </button>
            </div>
        </header>
    )
}
