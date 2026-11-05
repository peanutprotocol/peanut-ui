import Badge, { type StatusType } from '@/components/Global/Badges/Badge'

const STATUS_BY_KYC: Record<string, StatusType> = {
    APPROVED: 'completed',
    REJECTED: 'failed',
    FAILED: 'failed',
}

export default function KycBadge({ status }: { status: string | null | undefined }) {
    if (!status) return <Badge status="neutral" customText="No KYC" />
    return <Badge status={STATUS_BY_KYC[status.toUpperCase()] ?? 'pending'} customText={status} />
}
