/**
 * Local snooze for the re-consent prompt.
 *
 * ToS §17.2 gives material changes a 30-day runway and frames the in-app
 * click-through as a way to accept *sooner* — voluntarily. §17.3 then says a
 * user who does not agree must be able to stop using the Services, which for a
 * non-custodial wallet has to include reaching their funds. So the prompt is a
 * reminder, not a lock: "Not now" defers it instead of gating the app.
 *
 * Deliberately localStorage and not the consent ledger — declining is not a
 * consent event and must never write a row. Losing the snooze (cleared storage,
 * another device) just re-shows the prompt, which is the safe direction.
 */

/** Long enough not to nag a wallet people open daily, short enough to still land. */
export const RE_CONSENT_SNOOZE_DAYS = 3

const snoozeKey = (userId: string) => `peanut.reconsent.snoozedUntil.${userId}`

/** Storage is unavailable during SSR and throws outright in Safari private mode. */
function readStorage(key: string): string | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
    } catch {
        return null
    }
}

function writeStorage(key: string, value: string): void {
    try {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
    } catch {
        // a full or blocked quota just means the prompt returns next session
    }
}

export function isReConsentSnoozed(userId: string): boolean {
    const raw = readStorage(snoozeKey(userId))
    if (!raw) return false
    const until = Number(raw)
    // a corrupt value must not suppress the prompt forever
    return Number.isFinite(until) && until > Date.now()
}

export function snoozeReConsent(userId: string): void {
    const until = Date.now() + RE_CONSENT_SNOOZE_DAYS * 24 * 60 * 60 * 1000
    writeStorage(snoozeKey(userId), String(until))
}
