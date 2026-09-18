/**
 * The client perk API is retired. Perks are now issued and settled entirely
 * server-side — card activation, CARD_SPEND and FUND_WITHDRAW auto-claim on
 * issuance, and QR-pay rewards are paid by the backend payout retry job. There
 * is no client claim call any more, so `perksApi.getPendingPerks` /
 * `perksApi.claimPerk` are gone along with the home-carousel claim surface.
 *
 * Only the payload shape survives: the backend still emits the `pending_perk`
 * socket frame, and PerkClaimGiftBox still renders a perk.
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
