import { formatUsd } from './format'
import { EDGE_TYPE_LABELS, RECIPROCITY_LABELS, type Reciprocity } from './selectors'
import type { ExplorerNode, ExplorerRelationship } from './types'

interface RelationshipDetailsProps {
    relationship: ExplorerRelationship
    nodes: ReadonlyMap<string, ExplorerNode>
    reciprocity: Reciprocity
}

export default function RelationshipDetails({ relationship, nodes, reciprocity }: RelationshipDetailsProps) {
    const rows: Array<[string, React.ReactNode]> = [
        ['From', nodes.get(relationship.source)?.username ?? relationship.source],
        ['To', nodes.get(relationship.target)?.username ?? relationship.target],
        ['Type', EDGE_TYPE_LABELS[relationship.type]],
        ['Transactions', relationship.count.toLocaleString()],
        ['Total USD', formatUsd(relationship.totalUsd)],
        ['Direction', RECIPROCITY_LABELS[reciprocity]],
    ]

    return (
        <>
            <p className="mb-3 font-mono text-[11px] break-all text-grey-1">{relationship.id}</p>
            <dl className="space-y-2">
                {rows.map(([label, value]) => (
                    <div
                        key={label}
                        className="grid grid-cols-[105px_minmax(0,1fr)] gap-2 border-b border-n-1/10 pb-2 text-xs"
                    >
                        <dt className="text-grey-1">{label}</dt>
                        <dd className="font-semibold break-words">{value}</dd>
                    </div>
                ))}
            </dl>
        </>
    )
}
