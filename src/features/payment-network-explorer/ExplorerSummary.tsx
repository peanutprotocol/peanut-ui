/* eslint-disable react/jsx-no-literals -- internal team tool copy is intentionally not localized */
import InfoTooltip from './InfoTooltip'
import { formatCompactCount, formatUtc } from './format'
import { missingPrincipalMovementCount, settledEventCoveragePercent } from './selectors'
import type { PaymentNetworkResponse } from './types'

interface ExplorerSummaryProps {
    data: PaymentNetworkResponse
}

export default function ExplorerSummary({ data }: ExplorerSummaryProps) {
    const { sampling, coverage } = data.meta
    const missingPrincipalMovements = missingPrincipalMovementCount(coverage.missingPrincipal)
    const coveragePercent = settledEventCoveragePercent(sampling)
    return (
        <section
            className="flex min-h-12 items-center gap-5 border-b border-n-1 bg-[#fcfaf7] px-4 text-xs"
            aria-label="Data summary"
        >
            <span>
                <b>{formatCompactCount(sampling.returnedNodes)}</b> nodes
            </span>
            <span>
                <b>{formatCompactCount(sampling.returnedRelationships)}</b> relationships
            </span>
            <span>
                <b>{formatCompactCount(coverage.settledMovementCount)}</b> settled
            </span>
            {coverage.overlayEventCount > 0 && (
                <span className="rounded-full border border-n-1 bg-yellow-1 px-2 py-0.5 font-bold">
                    {formatCompactCount(coverage.overlayEventCount)} overlays
                </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5">
                <span
                    className={`size-2 rounded-full ${coverage.health === 'HEALTHY' ? 'bg-[#2a9d55]' : 'bg-[#d97706]'}`}
                    aria-hidden="true"
                />
                {coverage.health === 'HEALTHY' ? 'Healthy' : 'Review data'}
                <InfoTooltip label="data health">
                    {coverage.unclassifiedEventCount} unclassified events. {missingPrincipalMovements} movements across{' '}
                    {coverage.missingPrincipal.length} principal-gap groups.
                </InfoTooltip>
            </span>
            {sampling.truncated && (
                <span className="inline-flex items-center gap-1 rounded-full border border-n-1 bg-primary-3 px-2 py-0.5 font-bold">
                    {coveragePercent}% shown
                    <InfoTooltip label="sampling">
                        {sampling.matchedSettledEventCount === 0
                            ? 'No settled events matched; coverage is shown as 0%.'
                            : `${sampling.returnedSettledEventCount.toLocaleString()} of ${sampling.matchedSettledEventCount.toLocaleString()} matched settled events returned.`}{' '}
                        {sampling.returnedNodes.toLocaleString()} of {sampling.totalNodes.toLocaleString()} nodes and{' '}
                        {sampling.returnedRelationships.toLocaleString()} of{' '}
                        {sampling.totalRelationships.toLocaleString()} relationships. {sampling.reason}
                    </InfoTooltip>
                </span>
            )}
            <time className="text-grey-1" dateTime={data.meta.generatedAt}>
                {formatUtc(data.meta.generatedAt)}
            </time>
        </section>
    )
}
