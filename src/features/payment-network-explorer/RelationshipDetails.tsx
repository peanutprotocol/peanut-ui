import { formatUsd } from './format'
import { EDGE_TYPE_LABELS, RECIPROCITY_LABELS, type Reciprocity } from './selectors'
import type { ExplorerNode, ExplorerRelationship } from './types'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'

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
            <p className="mb-3 font-mono text-body-xs break-all text-foreground-secondary">{relationship.id}</p>
            <Card className="divide-y divide-dashed divide-border-default px-4">
                {rows.map(([label, value]) => (
                    <DataRow key={label} label={label} value={value} />
                ))}
            </Card>
        </>
    )
}
