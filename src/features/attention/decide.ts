import type {
    AskId,
    AttentionAsk,
    Decision,
    DecisionTrace,
    InterruptBudget,
    JourneyState,
    Ledger,
    LedgerEntry,
    Session,
    Tier,
    Verdict,
    ZonePick,
} from './types'

const DAY_MS = 24 * 60 * 60 * 1000

/** the Home push ask and announcements never fire on a user's first visits */
export const QUIET_SESSION_MIN_COUNT = 3
/** days between two announcement interrupts */
export const ANNOUNCEMENT_COOLDOWN_DAYS = 7
/** a card may hold the zone this many sessions in a row before yielding one (T3+) */
export const DEFAULT_MAX_CONSECUTIVE_SESSIONS = 3

const DEFAULT_BUDGET: Record<Tier, InterruptBudget> = {
    1: 'always',
    2: 'never',
    3: 'session',
    4: 'session',
    5: 'never',
    6: 'quiet',
}

export const budgetOf = (ask: AttentionAsk): InterruptBudget => ask.policy.interrupt ?? DEFAULT_BUDGET[ask.tier]

const byPriority = (a: AttentionAsk, b: AttentionAsk) => a.tier - b.tier || a.rank - b.rank

/**
 * Whether the ledger keeps this ask quiet right now. A snooze holds until its
 * date; a dismissal holds forever unless the policy gives it an expiry. Both
 * are tied to the version they were recorded for: a new legal document or a
 * new rejection code re-arms the ask.
 */
export function isSilenced(ask: AttentionAsk, entry: LedgerEntry | undefined, state: JourneyState): boolean {
    if (!entry) return false
    const version = ask.version?.(state)
    if (version !== undefined && entry.version !== undefined && entry.version !== version) return false
    if (entry.snoozedUntil && Date.parse(entry.snoozedUntil) > state.now) return true
    if (entry.dismissedAt) {
        const expiry = ask.policy.expiryDays
        if (expiry === undefined) return true
        const dismissed = Date.parse(entry.dismissedAt)
        return Number.isFinite(dismissed) && state.now - dismissed < expiry * DAY_MS
    }
    return false
}

/** Every ask of a higher tier (lower number) has settled, or the deadline passed. */
function higherTiersSettled(
    ask: AttentionAsk,
    asks: readonly AttentionAsk[],
    verdicts: Partial<Record<AskId, Verdict>>,
    session: Session
): boolean {
    if (session.settleDeadlinePassed) return true
    return !asks.some((other) => other.tier < ask.tier && verdicts[other.id] === 'unknown')
}

function lastInterruptOfTier(tier: Tier, asks: readonly AttentionAsk[], ledger: Ledger): number | null {
    let latest: number | null = null
    for (const ask of asks) {
        if (ask.tier !== tier) continue
        for (const iso of ledger[ask.id]?.shownAt ?? []) {
            const at = Date.parse(iso)
            if (Number.isFinite(at) && (latest === null || at > latest)) latest = at
        }
    }
    return latest
}

function interruptRefusal(
    ask: AttentionAsk,
    asks: readonly AttentionAsk[],
    verdicts: Partial<Record<AskId, Verdict>>,
    ledger: Ledger,
    session: Session,
    state: JourneyState,
    zoneIdle: boolean
): string | null {
    if (!ask.surfaces.includes('interrupt')) return 'no interrupt surface'
    const routes = ask.policy.routes ?? 'home'
    if (routes === 'home' && session.route !== 'home') return 'route'
    if ((ask.policy.minSessions ?? 0) > session.count) return 'too early'
    if (!higherTiersSettled(ask, asks, verdicts, session)) return 'higher tier unsettled'
    const shownT1 = session.interruptsThisSession.some((id) => asks.find((a) => a.id === id)?.tier === 1)
    switch (budgetOf(ask)) {
        case 'always':
            return null
        case 'never':
            return 'budget: never interrupts'
        case 'session':
            if (shownT1) return 'budget: a T1 interrupt already fired this session'
            if (session.interruptsThisSession.length) return 'budget: one interrupt per session'
            return null
        case 'quiet': {
            if (session.interruptsThisSession.length) return 'budget: one interrupt per session'
            if (session.count < QUIET_SESSION_MIN_COUNT) return 'budget: first sessions'
            if (!zoneIdle) return 'budget: zone not idle'
            const last = lastInterruptOfTier(ask.tier, asks, ledger)
            if (last !== null && state.now - last < ANNOUNCEMENT_COOLDOWN_DAYS * DAY_MS) return 'budget: cooldown'
            return null
        }
    }
}

/** A T3+ card that held the zone for its allowed run yields for one session. */
function isFatigued(ask: AttentionAsk, entry: LedgerEntry | undefined, session: Session): boolean {
    if (ask.tier < 3 || !entry?.lastSessionShown) return false
    const max = ask.policy.maxConsecutiveSessions ?? DEFAULT_MAX_CONSECUTIVE_SESSIONS
    return entry.lastSessionShown === session.count - 1 && (entry.consecutiveSessions ?? 0) >= max
}

/**
 * The one decision. Pure: the same inputs always give the same answer, so
 * every collision the app can produce is one row in a table test, and the
 * API can run the same function for push and email later.
 */
export function decide(state: JourneyState, asks: readonly AttentionAsk[], ledger: Ledger, session: Session): Decision {
    const sorted = [...asks].sort(byPriority)
    const verdicts: Partial<Record<AskId, Verdict>> = {}
    for (const ask of sorted) verdicts[ask.id] = ask.eligible(state)

    const live = sorted.filter((ask) => verdicts[ask.id] === 'show' && !isSilenced(ask, ledger[ask.id], state))
    const trace: DecisionTrace = { verdicts, candidates: live.map((ask) => ask.id), reasons: {} }

    // an open interrupt stays until the user answers it or it stops being eligible
    const open = session.openInterrupt
    const openStillLive = open !== null && live.some((ask) => ask.id === open)

    if (session.gateUp || session.busy) {
        return { interrupt: openStillLive ? open : null, zone: null, suspended: true, trace }
    }

    const zoneIdle = !live.some((ask) => ask.tier <= 5 && ask.surfaces.includes('zone'))

    let interrupt: AskId | null = openStillLive ? open : null
    for (const ask of live) {
        if (interrupt) {
            if (ask.id !== interrupt) trace.reasons[ask.id] = 'an interrupt is open'
            continue
        }
        const refusal = interruptRefusal(ask, sorted, verdicts, ledger, session, state, zoneIdle)
        if (refusal) trace.reasons[ask.id] = refusal
        else interrupt = ask.id
    }

    const zone = pickZone(live, sorted, verdicts, ledger, session, interrupt)
    return { interrupt, zone, suspended: false, trace }
}

function pickZone(
    live: readonly AttentionAsk[],
    sorted: AttentionAsk[],
    verdicts: Partial<Record<AskId, Verdict>>,
    ledger: Ledger,
    session: Session,
    interrupt: AskId | null
): ZonePick | null {
    if (session.route !== 'home') return null
    const candidates = live.filter((ask) => ask.id !== interrupt && ask.surfaces.includes('zone'))
    const fresh = candidates.find((ask) => !isFatigued(ask, ledger[ask.id], session))
    // every candidate is resting: better the top one again than an empty zone
    const pick = fresh ?? candidates[0]
    if (pick) return { id: pick.id, mode: 'ask' }
    const pending = sorted.find((ask) => verdicts[ask.id] === 'pending' && ask.surfaces.includes('zone'))
    return pending ? { id: pending.id, mode: 'status' } : null
}
