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

// per user, the store as this load last wrote it when storage refused the write
const unsaved = new Map<string, AttentionLedgerStore>()
let unsavedRevision = 0

export function resetLedgerMemoryForTests(): void {
    unsaved.clear()
    cached = null
}

const localStore = (userId: string, prefs: UserPreferences | undefined): unknown =>
    unsaved.get(userId) ?? prefs?.attention

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
        if (until) out['install-app'] = { snoozedUntil: until, updatedAt: prefs.migrationPromptSnoozedAt }
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
            ? { snoozedUntil: addDays(pushClosedAt, NOTIF_PROMPT_SNOOZE_DAYS), updatedAt: pushClosedAt }
            : { dismissedAt: pushClosedAt, updatedAt: pushClosedAt }
    }
    const hidden = prefs?.dismissedCarouselCTAs
    const hiddenIds = Array.isArray(hidden) ? hidden : Object.keys(hidden ?? {})
    // the legacy string[] shape carries no date: closed, at an unknown (oldest) time
    const closedAt = (id: string): string => {
        const at = Array.isArray(hidden) ? undefined : hidden?.[id]
        return isIso(at) ? at : new Date(0).toISOString()
    }
    // one entry per ask: the newest hidden blocked card; `version` keeps an
    // older hidden reason from silencing a new one (isSilenced compares it)
    const blocked = hiddenIds.filter((id) => id.startsWith(BLOCKED_CARD_PREFIX)).at(-1)
    if (blocked) {
        const at = !Array.isArray(hidden) ? hidden?.[blocked] : undefined
        const when = isIso(at) ? at : new Date(0).toISOString()
        out['blocked-card'] = { dismissedAt: when, version: blocked, updatedAt: when }
    }
    for (const id of hiddenIds) {
        const askId = LEGACY_CAROUSEL_ASK[id]
        if (!askId || out[askId]) continue
        // the app-install card came back after its cooldown; every other close was for good
        const at = closedAt(id)
        out[askId] =
            id === 'app-install'
                ? { snoozedUntil: addDays(at, APP_INSTALL_CARD_COOLDOWN_DAYS), updatedAt: at }
                : { dismissedAt: at, updatedAt: at }
    }
    return out
}

const fingerprintOf = (userId: string, prefs: UserPreferences | undefined, server: unknown): string =>
    JSON.stringify([
        server,
        prefs?.attention,
        unsaved.has(userId) && unsavedRevision,
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
const showHistory = (shownAt: string[]): string[] =>
    [...new Set(shownAt)].sort((a, b) => Date.parse(a) - Date.parse(b)).slice(-SHOWN_HISTORY_CAP)
const hasDecision = (entry: LedgerEntry): boolean => !!(entry.dismissedAt || entry.snoozedUntil)

/**
 * Field by field: the show history is the union of both sides; the answer
 * (dismissal, snooze and the version they were given for) comes from the
 * newer `updatedAt`, except that an entry without an answer (a show, from
 * either side) never erases one. A tie keeps `mine`.
 */
export function mergeEntry(mine: LedgerEntry | undefined, theirs: LedgerEntry): LedgerEntry {
    if (!mine) {
        const { shownAt, lastSessionShown: _last, consecutiveSessions: _run, ...rest } = theirs
        const history = showHistory(shownAt ?? [])
        return history.length ? { ...rest, shownAt: history } : rest
    }
    const theirsAnswers = hasDecision(theirs) !== hasDecision(mine) ? hasDecision(theirs) : stamp(theirs) > stamp(mine)
    const answer = theirsAnswers ? theirs : mine
    const newer = stamp(theirs) > stamp(mine) ? theirs : mine
    const shownAt = showHistory([...(mine.shownAt ?? []), ...(theirs.shownAt ?? [])])
    const out: LedgerEntry = {
        shownAt: shownAt.length ? shownAt : undefined,
        dismissedAt: answer.dismissedAt,
        snoozedUntil: answer.snoozedUntil,
        version: hasDecision(answer) ? answer.version : newer.version,
        // rotation counts this device's sessions: never taken over from another copy
        lastSessionShown: mine.lastSessionShown,
        consecutiveSessions: mine.consecutiveSessions,
        updatedAt: newer.updatedAt,
    }
    for (const key of Object.keys(out) as (keyof LedgerEntry)[]) if (out[key] === undefined) delete out[key]
    return out
}

export function mergeLedgers(mine: Ledger, theirs: Ledger): Ledger {
    const out: Ledger = { ...mine }
    for (const [id, entry] of Object.entries(theirs) as [AskId, LedgerEntry][]) out[id] = mergeEntry(out[id], entry)
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
 * The device's store, the pre-manager closes and `server` (the profile's
 * copy, passed by the provider), merged field by field (`mergeEntry`).
 */
export function readLedger(userId: string | null, server?: unknown): Ledger {
    if (!userId) return EMPTY
    const raw = getUserPreferences(userId)
    const fingerprint = fingerprintOf(userId, raw, server)
    if (cached && cached.userId === userId && cached.fingerprint === fingerprint) return cached.ledger
    const local = mergeLedgers(sanitizeStore(localStore(userId, raw)), legacyEntries(userId, raw))
    const ledger = mergeLedgers(local, withoutDeviceState(sanitizeStore(server)))
    cached = { userId, fingerprint, ledger }
    return ledger
}

/** The store to write on: the device's, with the pre-manager closes copied in once so they sync. */
function baseStore(userId: string, prefs: UserPreferences | undefined): AttentionLedgerStore {
    const store = sanitizeStore(localStore(userId, prefs))
    return prefs?.attentionLegacyPersisted ? store : mergeLedgers(store, legacyEntries(userId, prefs))
}

/** Push permission is per device, so its ask's answers stay on the device. */
const DEVICE_LOCAL_ASKS: ReadonlySet<AskId> = new Set(['push-home-fallback'])

/** What may cross devices: no device-local asks, and no zone rotation counters (they count this device's sessions). */
function withoutDeviceState(store: AttentionLedgerStore): AttentionLedgerStore {
    const out: AttentionLedgerStore = {}
    for (const [id, entry] of Object.entries(store) as [AskId, LedgerEntry][]) {
        if (DEVICE_LOCAL_ASKS.has(id)) continue
        const { lastSessionShown: _last, consecutiveSessions: _run, ...rest } = entry
        out[id] = rest
    }
    return out
}

function save(userId: string, next: AttentionLedgerStore): void {
    // storage can refuse (quota, private mode): the answer still holds for this load and still syncs
    if (updateUserPreferences(userId, { attention: next, attentionLegacyPersisted: true })) unsaved.delete(userId)
    else {
        unsaved.set(userId, next)
        unsavedRevision++
    }
    cached = null
    emit()
    scheduleLedgerSync(userId, withoutDeviceState(next))
}

function write(
    userId: string,
    askId: AskId,
    patch: (entry: LedgerEntry) => LedgerEntry,
    { answer = true }: { answer?: boolean } = {}
): void {
    const current = readLedger(userId, lastServer)
    const patched = patch({ ...(current[askId] ?? {}) })
    // `updatedAt` stamps answers only: a show must not outrank another device's newer answer
    const next: AttentionLedgerStore = {
        ...baseStore(userId, getUserPreferences(userId)),
        [askId]: answer ? { ...patched, updatedAt: new Date().toISOString() } : patched,
    }
    save(userId, next)
}

/** Copy the pre-manager closes into the synced store, once per user and device. */
export function persistLegacyLedger(userId: string): void {
    const prefs = getUserPreferences(userId)
    if (prefs?.attentionLegacyPersisted || unsaved.has(userId)) return
    const legacy = legacyEntries(userId, prefs)
    if (!Object.keys(legacy).length) {
        updateUserPreferences(userId, { attentionLegacyPersisted: true })
        return
    }
    save(userId, baseStore(userId, prefs))
}

// the server copy the provider last read with, so a write merges on top of it
let lastServer: unknown
export function noteServerLedger(server: unknown): void {
    lastServer = server
}

export const ledgerActions = {
    shown(userId: string, askId: AskId, now: number, surface: Surface, sessionCount: number) {
        write(
            userId,
            askId,
            (entry) => {
                const shownAt =
                    surface !== 'zone' ? [...(entry.shownAt ?? []), new Date(now).toISOString()] : entry.shownAt
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
            },
            { answer: false }
        )
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
        write(userId, askId, (entry) => ({
            ...entry,
            // a dismissal recorded for another version must not come back once this snooze ends
            dismissedAt: entry.version === version ? entry.dismissedAt : undefined,
            snoozedUntil: new Date(until).toISOString(),
            version,
        }))
    },
}
