export type BadgeHistoryEntry = {
    isBadge: true
    uuid: string
    timestamp: string
    code: string
    name: string
    description?: string | null
    iconUrl?: string | null
}

export const isBadgeHistoryItem = (entry: any): entry is BadgeHistoryEntry => !!entry?.isBadge
