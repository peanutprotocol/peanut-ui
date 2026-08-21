import InfoTooltip from './InfoTooltip'
import { formatCompactCount } from './format'
import { FIXED_WINDOW_LABEL } from './query'
import type { ExplorerGraphResponse } from './types'

interface ExplorerSummaryProps {
    data: ExplorerGraphResponse
    visibleRelationshipCount: number
    topNodes: number
}

export default function ExplorerSummary({ data, visibleRelationshipCount, topNodes }: ExplorerSummaryProps) {
    const { stats } = data
    return (
        <section
            className="flex min-h-12 items-center gap-5 border-b border-n-1 bg-[#fcfaf7] px-4 text-xs"
            aria-label="Data summary"
        >
            <span>
                <b>{formatCompactCount(data.nodes.length)}</b> users
            </span>
            <span>
                <b>{formatCompactCount(visibleRelationshipCount)}</b> of{' '}
                <b>{formatCompactCount(data.p2pEdges.length)}</b> payment edges
            </span>
            <span>
                <b>{formatCompactCount(stats.usersWithAccess)}</b> with app access
            </span>
            {/* The response carries no pre-limit population count (stats.totalNodes is
                the returned node count), so sampling is derived from the request. */}
            {topNodes > 0 && data.nodes.length >= topNodes && (
                <span className="inline-flex items-center gap-1 rounded-full border border-n-1 bg-primary-3 px-2 py-0.5 font-bold">
                    top {formatCompactCount(topNodes)} sample
                    <InfoTooltip label="sampling">
                        The server returned the top users by points plus recent signups; the full network is larger.
                        Raise the top-users filter to widen the graph.
                    </InfoTooltip>
                </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 text-grey-1">
                {FIXED_WINDOW_LABEL}
                <InfoTooltip label="data window">
                    Payment edges are aggregated by the backend over a fixed 120-day window and include completed
                    payments only. There is no time filter.
                </InfoTooltip>
            </span>
        </section>
    )
}
