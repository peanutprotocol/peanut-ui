import type { ExplorerRelationship, RelationshipAsset } from './types'

export function formatBaseUnitAmount(value: string, asset: RelationshipAsset): string {
    if (!/^-?\d+$/.test(value)) return `— ${asset.displayCode}`
    const negative = value.startsWith('-')
    const digits = negative ? value.slice(1) : value
    const padded = digits.padStart(asset.decimals + 1, '0')
    const wholeDigits = asset.decimals === 0 ? padded : padded.slice(0, -asset.decimals)
    const fraction = asset.decimals === 0 ? '' : padded.slice(-asset.decimals).replace(/0+$/, '')
    const whole = BigInt(wholeDigits || '0').toLocaleString('en-US')
    return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''} ${asset.displayCode}`
}

export function formatRelationshipAmount(relationship: ExplorerRelationship): string {
    if (!relationship.asset) return '—'
    if (relationship.state === 'SETTLED' && relationship.nativeAmount !== null) {
        return formatBaseUnitAmount(relationship.nativeAmount, relationship.asset)
    }
    if (
        (relationship.state === 'REFUNDED' || relationship.state === 'REVERSED') &&
        relationship.overlayNativeAmount !== null
    ) {
        return formatBaseUnitAmount(relationship.overlayNativeAmount, relationship.asset)
    }
    return '—'
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
