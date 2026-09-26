/**
 * Perks issue and settle server-side only; there is no client perk API. This
 * payload type survives for PerkClaimGiftBox's prop — a component with no
 * mount site, whose removal is an open decision (TASK-22680).
 */
export type PendingPerk = {
    id: string
    name?: string
    description?: string
    reason?: string
    amountUsd: number
    createdAt: string
    /** Extracted invitee name from BE (avoids FE regex parsing of reason) */
    inviteeName?: string
}
