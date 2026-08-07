import { formatRelationshipAmount, formatUtc } from './format'
import type { ExplorerNode, ExplorerRelationship } from './types'

interface RelationshipDetailsProps {
    relationship: ExplorerRelationship
    nodes: ReadonlyMap<string, ExplorerNode>
}

export default function RelationshipDetails({ relationship, nodes }: RelationshipDetailsProps) {
    const rows: Array<[string, React.ReactNode]> = [
        ['From', nodes.get(relationship.source)?.label ?? relationship.source],
        ['To', nodes.get(relationship.target)?.label ?? relationship.target],
        ['State', relationship.state],
        ['Rail', relationship.rail],
        ['Method', relationship.method],
        ['Provider', relationship.provider],
        ['Kind', relationship.kind],
        ['Direction', relationship.direction],
        ['Events', relationship.count.toLocaleString()],
        ['Settled payments', relationship.settledPaymentCount.toLocaleString()],
        [
            relationship.state === 'SETTLED' ? 'Settled native amount' : 'Overlay native amount',
            formatRelationshipAmount(relationship),
        ],
        ['Evidence', relationship.evidence],
        ['Time basis', relationship.timeBasis],
        ['First', formatUtc(relationship.firstAt)],
        ['Last', formatUtc(relationship.lastAt)],
        ['Bidirectional', relationship.bidirectional ? 'Yes' : 'No'],
    ]

    return (
        <>
            <p className="mb-3 break-all font-mono text-[11px] text-grey-1">{relationship.id}</p>
            <dl className="space-y-2">
                {rows.map(([label, value]) => (
                    <div
                        key={label}
                        className="grid grid-cols-[105px_minmax(0,1fr)] gap-2 border-b border-n-1/10 pb-2 text-xs"
                    >
                        <dt className="text-grey-1">{label}</dt>
                        <dd className="break-words font-semibold">{value}</dd>
                    </div>
                ))}
            </dl>
        </>
    )
}
