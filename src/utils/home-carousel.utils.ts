import { QrKycState } from '@/constants/kyc.consts'
import { qrPayIsAPath } from '@/features/payments/flows/qr-pay/qrKycGate.utils'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'

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

/** The getting-started checklist, hidden with "Hide" once only the payment row is left. */
export const HOME_CHECKLIST_CTA_ID = 'home-checklist'

/** The cards that replace the checklist when a door is shut (region refused, provider rejection). */
export type BlockedCardKind =
    | 'region-restricted'
    | 'add-email'
    | 'complete-setup'
    | 'restart-identity'
    | 'verification-issue'

/**
 * A blocked card's dismissal key: its kind plus the reason code. A new reason
 * (another verdict or code) is a new key, so the card shows again once.
 */
export function blockedCardCtaId(kind: BlockedCardKind, reasonCode: string | null | undefined): string {
    return `blocked-card:${kind}:${reasonCode ?? 'none'}`
}

/**
 * The Home CTAs a user closed that stay hidden now: carousel cards and the
 * getting-started checklist share this one store (user preferences,
 * `dismissedCarouselCTAs`).
 */
export function readHiddenHomeCtas(userId: string | undefined): Map<string, Date> {
    return hiddenCarouselCTAs(getUserPreferences(userId)?.dismissedCarouselCTAs, new Date())
}

/** Record that the user closed a Home CTA. Merges into what is stored, so two closers never overwrite each other. */
export function hideHomeCta(userId: string | undefined, id: string): void {
    const now = new Date().toISOString()
    const stored = getUserPreferences(userId)?.dismissedCarouselCTAs
    const record: Record<string, string> = Array.isArray(stored)
        ? Object.fromEntries(stored.map((storedId) => [storedId, now]))
        : { ...(stored ?? {}) }
    record[id] = now
    updateUserPreferences(userId, { dismissedCarouselCTAs: record })
}

/**
 * A carousel slide that asks the user to verify ("Unlock QR code payments")
 * shows only to a user whose identity is not verified, and only when verifying
 * can open QR pay: the QR-pay gate says QR is a path but not yet open. Never
 * for a refused region or a blocked provider, where the ID check leads
 * nowhere, and never while the user is already mid-flow. "Verified" is the
 * identity status itself (the checklist's Verify row reads the same), not a
 * provider rail: a verified user with no pool rail must not be asked again.
 */
export function showVerifyCTA(input: {
    qrGateState: QrKycState
    isIdentityVerified: boolean
    isInFlight: boolean
    isCardEligible: boolean | undefined
}): boolean {
    return (
        qrPayIsAPath(input.qrGateState) === true &&
        input.qrGateState !== QrKycState.PROCEED_TO_PAY &&
        !input.isIdentityVerified &&
        !input.isInFlight &&
        // card-eligible users verify through the card flow instead
        input.isCardEligible === false
    )
}
