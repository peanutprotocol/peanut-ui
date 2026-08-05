export type BadgeHistoryEntry = {
    isBadge: true
    uuid: string
    timestamp: string
    code: string
    name: string
    description?: string | null
    iconUrl?: string | null
}

export const isBadgeHistoryItem = (entry: unknown): entry is BadgeHistoryEntry =>
    typeof entry === 'object' && entry !== null && !!(entry as { isBadge?: unknown }).isBadge
