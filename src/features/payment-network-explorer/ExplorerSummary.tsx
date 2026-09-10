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
            {/* The response carries no pre-limit population count (stats.totalNodes is the
                returned node count), so this is a property of the REQUEST, not evidence of
                truncation: a network of exactly topNodes users looks identical here, and
                includeNewDays can push the count past topNodes without truncation either. */}
            {topNodes > 0 && data.nodes.length >= topNodes && (
                <span className="inline-flex items-center gap-1 rounded-full border border-n-1 bg-primary-3 px-2 py-0.5 font-bold">
                    top {formatCompactCount(topNodes)} requested
                    <InfoTooltip label="sampling">
                        The server was asked for the top users by points, plus signups from the last 30 days. The
                        response carries no pre-limit total, so this does not by itself mean the network is larger.
                        Raise the top-users filter to find out.
                    </InfoTooltip>
                </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 text-grey-1">
                {FIXED_WINDOW_LABEL}
                <InfoTooltip label="data window">
                    Payment edges are aggregated by the backend over a fixed 120-day window. There is no time filter.
                    Send-link and request payments count completed transfers only; direct transfers carry no status
                    filter, so a pending or stuck deposit can appear.
                </InfoTooltip>
            </span>
        </section>
    )
}
