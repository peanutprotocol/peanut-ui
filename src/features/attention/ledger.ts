import { getUserPreferences, updateUserPreferences, type UserPreferences } from '@/utils/general.utils'
import { DOWNLOAD_PROMPT_SNOOZE_DAYS, NOTIF_PROMPT_SNOOZE_DAYS } from '@/constants/migration.consts'
import { isPwaSunsetOn } from '@/utils/migration.utils'
import { scheduleLedgerSync } from './ledgerSync'
import type { AskId, Ledger, LedgerEntry, Surface } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const SHOWN_HISTORY_CAP = 10
/** blockedCardCtaId() keys (home-carousel.utils) */
const BLOCKED_CARD_PREFIX = 'blocked-card:'
/** the carousel slide ids a user may have closed before the zone, by the ask that replaced each */
const LEGACY_CAROUSEL_ASK: Record<string, AskId> = {
    'user-interview': 'user-interview',
    'app-install': 'install-app',
    'invite-friends': 'invite',
    'latam-cashback-invite': 'invite',
    'notification-prompt': 'push-home-fallback',
    'qr-payment': 'qr-payment',
    'bug-bounty': 'bug-bounty',
    'card-offer': 'card-offer',
    'kyc-prompt': 'verify-for-qr',
}
export const APP_INSTALL_CARD_COOLDOWN_DAYS = 7

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

export function subscribeLedger(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/**
 * The stored shape (`UserPreferences.attention`), written only by this
 * module. The legacy per-prompt fields are read once below so the manager's
 * first decisions on an upgraded device match what the old code would have
 * done; they are never written by the manager.
 */
export type AttentionLedgerStore = Partial<Record<AskId, LedgerEntry>>

const EMPTY: Ledger = {}

// useSyncExternalStore needs the same object back while nothing changed, and
// getUserPreferences parses a fresh one on every call: cache on the inputs
let cached: { userId: string; fingerprint: string; ledger: Ledger } | null = null

/** Storage is per device, so a corrupt or absent value only means the ask returns. */
function readReconsentSnooze(userId: string): string | undefined {
    try {
        if (typeof window === 'undefined') return undefined
        const raw = window.localStorage.getItem(`peanut.reconsent.snoozedUntil.${userId}`)
        const until = raw === null ? NaN : Number(raw)
        return Number.isFinite(until) ? new Date(until).toISOString() : undefined
    } catch {
        return undefined
    }
}

const addDays = (iso: string, days: number): string | undefined => {
    const at = Date.parse(iso)
    return Number.isFinite(at) ? new Date(at + days * DAY_MS).toISOString() : undefined
}

/**
 * The entries the pre-manager prompts recorded under their own keys. Each
 * mirrors that prompt's own rule, so a device that already snoozed the
 * download prompt is not asked again the day the manager ships.
 */
export function legacyEntries(userId: string, prefs: UserPreferences | undefined): Ledger {
    const out: Ledger = {}
    const reconsent = readReconsentSnooze(userId)
    if (reconsent) out['legal-reconsent'] = { snoozedUntil: reconsent }
    if (isIso(prefs?.migrationPromptSnoozedAt)) {
        const until = addDays(prefs.migrationPromptSnoozedAt, DOWNLOAD_PROMPT_SNOOZE_DAYS)
        if (until) out['install-app'] = { snoozedUntil: until }
    }
    const balance = prefs?.hasSeenBalanceWarning
    if (balance?.value && Number.isFinite(balance.expiry)) {
        out['balance-backup'] = { snoozedUntil: new Date(balance.expiry).toISOString() }
    }
    const pushClosedAt = isIso(prefs?.notifModalClosedAt)
        ? prefs.notifModalClosedAt
        : prefs?.notifModalClosed
          ? new Date(0).toISOString()
          : undefined
    if (pushClosedAt) {
        // flag off: the old prompt closed forever; flag on: a snooze
        out['push-home-fallback'] = isPwaSunsetOn()
            ? { snoozedUntil: addDays(pushClosedAt, NOTIF_PROMPT_SNOOZE_DAYS) }
            : { dismissedAt: pushClosedAt }
    }
    const hidden = prefs?.dismissedCarouselCTAs
    const hiddenIds = Array.isArray(hidden) ? hidden : Object.keys(hidden ?? {})
    // the legacy string[] shape carries no date and reads as closed now
    const closedAt = (id: string): string => {
        const at = Array.isArray(hidden) ? undefined : hidden?.[id]
        return isIso(at) ? at : new Date().toISOString()
    }
    // one entry per ask: the newest hidden blocked card; `version` keeps an
    // older hidden reason from silencing a new one (isSilenced compares it)
    const blocked = hiddenIds.filter((id) => id.startsWith(BLOCKED_CARD_PREFIX)).at(-1)
    if (blocked) {
        const at = !Array.isArray(hidden) ? hidden?.[blocked] : undefined
        out['blocked-card'] = { dismissedAt: isIso(at) ? at : new Date(0).toISOString(), version: blocked }
    }
    for (const id of hiddenIds) {
        const askId = LEGACY_CAROUSEL_ASK[id]
        if (!askId || out[askId]) continue
        // the app-install card came back after its cooldown; every other close was for good
        out[askId] =
            id === 'app-install'
                ? { snoozedUntil: addDays(closedAt(id), APP_INSTALL_CARD_COOLDOWN_DAYS) }
                : { dismissedAt: closedAt(id) }
    }
    return out
}

const fingerprintOf = (userId: string, prefs: UserPreferences | undefined, server: unknown): string =>
    JSON.stringify([
        server,
        prefs?.attention,
        prefs?.migrationPromptSnoozedAt,
        prefs?.hasSeenBalanceWarning,
        prefs?.notifModalClosedAt,
        prefs?.notifModalClosed,
        prefs?.dismissedCarouselCTAs,
        readReconsentSnooze(userId),
    ])

const isIso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))

/** Storage is user-writable and survives every deploy: only well-typed fields come through. */
export function sanitizeEntry(raw: unknown): LedgerEntry | undefined {
    if (!raw || typeof raw !== 'object') return undefined
    const entry = raw as Record<string, unknown>
    const out: LedgerEntry = {}
    if (Array.isArray(entry.shownAt)) out.shownAt = entry.shownAt.filter(isIso)
    if (isIso(entry.dismissedAt)) out.dismissedAt = entry.dismissedAt
    if (isIso(entry.snoozedUntil)) out.snoozedUntil = entry.snoozedUntil
    if (typeof entry.version === 'string') out.version = entry.version
    if (typeof entry.lastSessionShown === 'number' && Number.isFinite(entry.lastSessionShown))
        out.lastSessionShown = entry.lastSessionShown
    if (typeof entry.consecutiveSessions === 'number' && Number.isFinite(entry.consecutiveSessions))
        out.consecutiveSessions = entry.consecutiveSessions
    if (isIso(entry.updatedAt)) out.updatedAt = entry.updatedAt
    return out
}

const stamp = (entry: LedgerEntry): number => (entry.updatedAt ? Date.parse(entry.updatedAt) : 0)

/** Per ask, the newer `updatedAt` wins; no stamp counts as epoch 0; a tie keeps local. */
export function mergeLedgers(local: Ledger, server: Ledger): Ledger {
    const out: Ledger = { ...local }
    for (const [id, entry] of Object.entries(server) as [AskId, LedgerEntry][]) {
        const mine = out[id]
        if (!mine || stamp(entry) > stamp(mine)) out[id] = entry
    }
    return out
}

function sanitizeStore(raw: unknown): Ledger {
    if (!raw || typeof raw !== 'object') return {}
    const out: Ledger = {}
    for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
        const clean = sanitizeEntry(entry)
        if (clean) out[id as AskId] = clean
    }
    return out
}

/**
 * Legacy entries fill gaps only; where both devices wrote, the newer entry
 * wins (`mergeLedgers`). `server` is the profile's copy, passed by the provider.
 */
export function readLedger(userId: string | null, server?: unknown): Ledger {
    if (!userId) return EMPTY
    const raw = getUserPreferences(userId)
    const fingerprint = fingerprintOf(userId, raw, server)
    if (cached && cached.userId === userId && cached.fingerprint === fingerprint) return cached.ledger
    const legacy = legacyEntries(userId, raw)
    const ledger: Ledger = { ...legacy, ...mergeLedgers(sanitizeStore(raw?.attention), sanitizeStore(server)) }
    cached = { userId, fingerprint, ledger }
    return ledger
}

function write(userId: string, askId: AskId, patch: (entry: LedgerEntry) => LedgerEntry): void {
    const current = readLedger(userId, lastServer)
    const next: AttentionLedgerStore = {
        ...(getUserPreferences(userId)?.attention ?? {}),
        [askId]: { ...patch({ ...(current[askId] ?? {}) }), updatedAt: new Date().toISOString() },
    }
    updateUserPreferences(userId, { attention: next })
    cached = null
    emit()
    scheduleLedgerSync(userId, next)
}

// the server copy the provider last read with, so a write merges on top of it
let lastServer: unknown
export function noteServerLedger(server: unknown): void {
    lastServer = server
}

export const ledgerActions = {
    shown(userId: string, askId: AskId, now: number, surface: Surface, sessionCount: number) {
        write(userId, askId, (entry) => {
            const shownAt = surface !== 'zone' ? [...(entry.shownAt ?? []), new Date(now).toISOString()] : entry.shownAt
            const consecutive =
                surface === 'zone'
                    ? entry.lastSessionShown === sessionCount
                        ? (entry.consecutiveSessions ?? 1)
                        : entry.lastSessionShown === sessionCount - 1
                          ? (entry.consecutiveSessions ?? 0) + 1
                          : 1
                    : entry.consecutiveSessions
            return {
                ...entry,
                shownAt: shownAt?.slice(-SHOWN_HISTORY_CAP),
                ...(surface === 'zone' && { lastSessionShown: sessionCount, consecutiveSessions: consecutive }),
            }
        })
    },
    dismissed(userId: string, askId: AskId, now: number, version?: string) {
        write(userId, askId, (entry) => ({
            ...entry,
            dismissedAt: new Date(now).toISOString(),
            snoozedUntil: undefined,
            version,
        }))
    },
    snoozed(userId: string, askId: AskId, until: number, version?: string) {
        write(userId, askId, (entry) => ({ ...entry, snoozedUntil: new Date(until).toISOString(), version }))
    },
    /** completion is derived from state; this only clears a stale silence */
    cleared(userId: string, askId: AskId) {
        write(userId, askId, (entry) => ({ ...entry, dismissedAt: undefined, snoozedUntil: undefined }))
    },
}
