/**
 * Home carousel rules (TASK-23054, Konrad's QR banner rule, 2026-09-25).
 *
 * A card closed with × never comes back. The one exception is this allow-list:
 * a card whose action still matters after a close returns after its cooldown,
 * and each entry says why. (A document request with a due date is not here: it
 * has no × at all — PendingVerificationTasks owns it.)
 */
export const RECURRING_CAROUSEL_CTAS: Record<string, { cooldownDays: number; reason: string }> = {
    'app-install': {
        cooldownDays: 7,
        reason: 'The web app is being retired: users who have not installed the app lose access at the cutoff.',
    },
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The carousel ids a user has closed and that stay hidden now.
 *
 * `stored` is the `dismissedCarouselCTAs` preference: id → ISO date, or the
 * legacy `string[]` shape (no dates), which reads as "closed now".
 */
export function hiddenCarouselCTAs(
    stored: Record<string, string> | string[] | undefined,
    now: Date
): Map<string, Date> {
    if (!stored) return new Map()
    const entries: Array<[string, Date]> = Array.isArray(stored)
        ? stored.map((id) => [id, now])
        : Object.entries(stored).map(([id, iso]) => [id, new Date(iso)])

    const hidden = new Map<string, Date>()
    for (const [id, closedAt] of entries) {
        const recurring = RECURRING_CAROUSEL_CTAS[id]
        if (!recurring) {
            // an unreadable date still means the user closed it
            hidden.set(id, closedAt)
            continue
        }
        if (!Number.isNaN(closedAt.getTime()) && now.getTime() - closedAt.getTime() < recurring.cooldownDays * DAY_MS) {
            hidden.set(id, closedAt)
        }
    }
    return hidden
}

/**
 * "Pay with QR" is for a user who can pay a QR right now (the QR-pay KYC gate
 * says PROCEED_TO_PAY) and has not yet. Never after a QR pay.
 * `hasMadeQrPayment` undefined means history is still loading: keep it hidden
 * so it does not flash in and out.
 */
export function showQrPayCTA(input: { canPayQrNow: boolean; hasMadeQrPayment: boolean | undefined }): boolean {
    return input.canPayQrNow && input.hasMadeQrPayment === false
}
