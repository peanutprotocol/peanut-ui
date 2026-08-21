export function formatUsd(value: number): string {
    if (!Number.isFinite(value)) return '—'
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
    }).format(value)
}

export function formatUtc(iso: string): string {
    const date = new Date(iso)
    if (!Number.isFinite(date.getTime())) return '—'
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
    }).format(date)
}

export function formatCompactCount(value: number): string {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}
