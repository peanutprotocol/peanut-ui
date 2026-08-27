import StatusBadge, { type StatusType } from '@/components/Global/Badges/StatusBadge'

type DocStatus = 'production' | 'limited' | 'unused' | 'needs-refactor'

// doc status -> the DS StatusBadge tone that carries it (no hand-rolled pill)
const MAP: Record<DocStatus, { status: StatusType; label: string }> = {
    production: { status: 'completed', label: 'production' },
    limited: { status: 'pending', label: 'limited use' },
    unused: { status: 'custom', label: 'unused' },
    'needs-refactor': { status: 'failed', label: 'needs refactor' },
}

export function StatusTag({ status }: { status: DocStatus }) {
    const m = MAP[status]
    return <StatusBadge status={m.status} customText={m.label} />
}
