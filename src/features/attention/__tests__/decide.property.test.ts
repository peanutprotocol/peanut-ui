/**
 * Property tests for the attention manager: generated states, ledgers and
 * sessions over the real registry, checked against the invariants in
 * mono engineering/qa/docs/attention-invariants.md (written from the product
 * docs, not from this code). Example tests live in decide.test.ts.
 */
import fc from 'fast-check'
import {
    ANNOUNCEMENT_COOLDOWN_DAYS,
    DEFAULT_MAX_CONSECUTIVE_SESSIONS,
    QUIET_SESSION_MIN_COUNT,
    budgetOf,
    decide,
    isSilenced,
} from '../decide'
import { ASKS } from '../registry'
import { mergeLedgers } from '../ledger'
import type { AskId, AttentionAsk, Decision, JourneyState, Ledger, LedgerEntry, Session, SlotId } from '../types'

jest.mock('../ledgerSync', () => ({ scheduleLedgerSync: jest.fn() }))

const NOW = Date.parse('2026-10-26T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000
const RUNS = Number(process.env.ATTENTION_PROPERTY_RUNS ?? 3000)

const ASK_BY_ID = new Map(ASKS.map((ask) => [ask.id, ask]))
const askOf = (id: AskId) => ASK_BY_ID.get(id) as AttentionAsk
const INTERRUPT_IDS = ASKS.filter((ask) => ask.surfaces.includes('interrupt')).map((ask) => ask.id)
const ALL_IDS = ASKS.map((ask) => ask.id)
const outranks = (a: AttentionAsk, b: AttentionAsk) => a.tier < b.tier || (a.tier === b.tier && a.rank < b.rank)
const iso = (offsetDays: number) => new Date(NOW + offsetDays * DAY_MS).toISOString()

// ---------- generators ----------

const onboardingArb = fc.option(
    fc.record({
        verify: fc.constantFrom('todo', 'in_review', 'action_required', 'failed', 'done'),
        addMoneyDone: fc.boolean(),
        firstPaymentDone: fc.boolean(),
        firstPaymentRoute: fc.constantFrom('card_qr', 'card', 'qr', 'none', 'pending'),
        step: fc.constantFrom('verify', 'add_money', 'first_payment', 'completed'),
    }),
    { nil: null }
)

export const stateArb: fc.Arbitrary<JourneyState> = fc
    .record({
        capNudge: fc.constantFrom(
            null,
            undefined,
            { state: 'raise', actionKey: 'sumsub:source_of_funds' },
            { state: 'under-review' }
        ),
        maintenance: fc.constantFrom('none', 'none', 'scoped', 'full'),
        userId: fc.constantFrom('user-a', 'user-a', 'user-a', null),
        userLoaded: fc.constantFrom(true, true, true, true, false),
        isNative: fc.boolean(),
        route: fc.constantFrom('home', 'home', 'other'),
        consentStatus: fc.constantFrom('unknown', 'clear', 'clear', 'needed'),
        consentVersion: fc.constantFrom('2026-10-01', '2026-11-01'),
        identity: fc.record({
            status: fc.constantFrom(undefined, 'not_started', 'pending', 'verified', 'action_required', 'rejected'),
            isVerified: fc.boolean(),
            needsAction: fc.boolean(),
            isTerminalFailure: fc.boolean(),
            isRegionRestricted: fc.boolean(),
        }),
        onboarding: onboardingArb,
        blockedCardId: fc.constantFrom(null, null, 'blocked-1'),
        dueTasks: fc.nat(2),
        card: fc.record({
            loaded: fc.boolean(),
            needsSetup: fc.boolean(),
            activeCardId: fc.constantFrom(null, 'card-1', 'card-2'),
        }),
        postAuthRedirect: fc.boolean(),
        postAuthRedirectDestination: fc.constantFrom(null, '/claim?c=1', '/a/b?chargeId=1'),
        balance: fc.record({ loaded: fc.boolean(), usd: fc.constantFrom(0, 3, 120, 501, 900) }),
        migration: fc.record({ on: fc.boolean() }),
        push: fc.record({
            ready: fc.boolean(),
            unanswered: fc.boolean(),
            promptedThisSession: fc.boolean(),
            notEnabled: fc.boolean(),
        }),
        showEarlyUserModal: fc.constantFrom(undefined, true, false),
        activated: fc.boolean(),
        geoCountry: fc.constantFrom(null, 'AR', 'BR', 'US'),
        invitesSent: fc.nat(2),
        hasSupportSurvivorBadge: fc.boolean(),
        cardOffer: fc.record({
            loaded: fc.boolean(),
            geoProhibited: fc.boolean(),
            hasCardRelationship: fc.boolean(),
            promotionDisabled: fc.boolean(),
        }),
        qr: fc.record({
            canPayNow: fc.boolean(),
            hasMadeQrPayment: fc.constantFrom(undefined, true, false),
            verifyOpensQr: fc.boolean(),
        }),
        documentSlideKey: fc.constantFrom(null, 'doc-1', 'doc-2'),
        flags: fc.record({ userInterview: fc.boolean() }),
        depositAccounts: fc.record({
            enabled: fc.boolean(),
            loaded: fc.boolean(),
            claimable: fc.nat(1),
            active: fc.nat(1),
        }),
        lastSpendAt: fc.constantFrom(null, iso(-1), iso(-20)),
        hasReceivedRequestPayment: fc.constantFrom(undefined, true, false),
        firstPeerPaymentAt: fc.constantFrom(null, iso(-30)),
        passkeyCount: fc.constantFrom(null, 0, 1, 2),
        hasEmail: fc.boolean(),
        hasFullName: fc.boolean(),
        rewardsPendingUsd: fc.constantFrom(undefined, 0, 5),
        arrival: fc.constantFrom('unknown', 'none', 'none', 'raised'),
    })
    .map(
        ({ consentStatus, consentVersion, ...rest }) =>
            ({
                ...rest,
                now: NOW,
                consent: {
                    status: consentStatus,
                    versions: consentStatus === 'needed' ? [consentVersion] : [],
                    documents: consentStatus === 'needed' ? [{ slug: 'terms', currentVersion: consentVersion }] : [],
                },
                serverLedger: undefined,
            }) as unknown as JourneyState
    )

const entryArb: fc.Arbitrary<LedgerEntry> = fc.record(
    {
        shownAt: fc.array(fc.constantFrom(iso(-1), iso(-3), iso(-8), iso(-30)), { maxLength: 3 }),
        dismissedAt: fc.constantFrom(iso(-1), iso(-25)),
        snoozedUntil: fc.constantFrom(iso(-1), iso(2)),
        version: fc.constantFrom('2026-10-01', '2026-11-01', 'card-1', 'blocked-1', 'doc-1', '5'),
        lastSessionShown: fc.nat(6),
        consecutiveSessions: fc.nat(5),
        updatedAt: fc.constantFrom(iso(-2), iso(-1)),
    },
    { requiredKeys: [] }
)

export const ledgerArb: fc.Arbitrary<Ledger> = fc.dictionary(fc.constantFrom(...ALL_IDS), entryArb, {
    maxKeys: 8,
}) as fc.Arbitrary<Ledger>

const slotArb = fc.subarray([
    { id: 'bank-transfer' as SlotId, context: { advisoryDeadline: iso(10) } },
    { id: 'bank-transfer' as SlotId, context: { advisoryDeadline: null } },
    { id: 'limits' as SlotId },
])

const sessionArb = (state: JourneyState): fc.Arbitrary<Session> =>
    fc.record({
        slots: slotArb,
        count: fc.nat(6),
        route: fc.constant(state.route),
        interruptsThisSession: fc.subarray(INTERRUPT_IDS, { maxLength: 2 }),
        openInterrupt: fc.option(fc.constantFrom(...INTERRUPT_IDS), { nil: null, freq: 4 }),
        busy: fc.constantFrom(false, false, false, true),
        gateUp: fc.constantFrom(false, false, false, false, false, false, false, false, false, true),
        settleDeadlinePassed: fc.boolean(),
    })

const caseArb = stateArb.chain((state) => fc.tuple(fc.constant(state), ledgerArb, sessionArb(state)))

// ---------- helpers that read the decision the way the docs describe it ----------

function live(state: JourneyState, ledger: Ledger, decision: Decision) {
    return ASKS.filter((ask) => decision.trace.verdicts[ask.id] === 'show' && !isSilenced(ask, ledger[ask.id], state))
}

function mayInterruptNow(ask: AttentionAsk, state: JourneyState, session: Session) {
    if (!ask.surfaces.includes('interrupt')) return false
    if (ask.policy.surfaceWhen?.interrupt && !ask.policy.surfaceWhen.interrupt(state)) return false
    if ((ask.policy.routes ?? 'home') === 'home' && session.route !== 'home') return false
    return (ask.policy.minSessions ?? 0) <= session.count
}

const anchorOf = (liveAsks: AttentionAsk[]) => liveAsks.find((ask) => ask.policy.anchorsHome) ?? null

function check(name: string, predicate: (state: JourneyState, ledger: Ledger, session: Session, d: Decision) => void) {
    test(name, () => {
        fc.assert(
            fc.property(caseArb, ([state, ledger, session]) => {
                predicate(state, ledger, session, decide(state, ASKS, ledger, session))
            }),
            { numRuns: RUNS }
        )
    })
}

// ---------- A: one call to action per surface ----------

describe('A. one call to action at a time', () => {
    check('the interrupt, zone card and inline notice are three different asks', (_s, _l, _session, d) => {
        const picks = [d.interrupt, d.zone?.id, d.inline?.id].filter(Boolean)
        expect(new Set(picks).size).toBe(picks.length)
    })

    check('a gate pauses everything', (_s, _l, session, d) => {
        if (!session.gateUp) return
        expect([d.interrupt, d.zone, d.inline, d.banner]).toEqual([null, null, null, null])
    })

    check('decide is pure: same inputs, same answer, inputs untouched', (state, ledger, session, d) => {
        const copies = JSON.parse(JSON.stringify({ state, ledger, session }))
        const again = decide(state, ASKS, ledger, session)
        expect(again).toEqual(d)
        expect(JSON.parse(JSON.stringify({ state, ledger, session }))).toEqual(copies)
    })
})

// ---------- B/C/D/E: what may interrupt ----------

describe('B–E. the interrupt', () => {
    check('it is a live ask with an interrupt surface, allowed on this route', (state, ledger, session, d) => {
        if (!d.interrupt) return
        const ask = askOf(d.interrupt)
        expect(live(state, ledger, d).map((a) => a.id)).toContain(d.interrupt)
        expect(ask.surfaces).toContain('interrupt')
        if (d.interrupt !== session.openInterrupt) expect(mayInterruptNow(ask, state, session)).toBe(true)
    })

    check('busy: nothing new opens; only an open interrupt that is still live stays', (_state, _l, session, d) => {
        if (!session.busy || !d.interrupt) return
        expect(d.interrupt).toBe(session.openInterrupt)
    })

    check('a lower tier never takes the interrupt while a live tier-1 ask could open', (state, ledger, session, d) => {
        if (!d.interrupt || d.interrupt === session.openInterrupt || session.busy) return
        const chosen = askOf(d.interrupt)
        const blocking = live(state, ledger, d).filter(
            (ask) =>
                ask.tier === 1 &&
                budgetOf(ask) === 'always' &&
                outranks(ask, chosen) &&
                mayInterruptNow(ask, state, session)
        )
        expect(blocking.map((a) => a.id)).toEqual([])
    })

    check('an unknown ask holds every interrupt it outranks until the settle deadline', (_state, _l, session, d) => {
        if (!d.interrupt || d.interrupt === session.openInterrupt || session.settleDeadlinePassed) return
        const chosen = askOf(d.interrupt)
        const holders = ASKS.filter((ask) => d.trace.verdicts[ask.id] === 'unknown' && outranks(ask, chosen))
        expect(holders.map((a) => a.id)).toEqual([])
    })

    check('while the to-do list is live on Home, only a higher tier interrupts', (state, ledger, session, d) => {
        if (!d.interrupt || d.interrupt === session.openInterrupt || session.route !== 'home') return
        const anchor = anchorOf(live(state, ledger, d))
        if (anchor) expect(askOf(d.interrupt).tier).toBeLessThan(anchor.tier)
    })

    check(
        'budgets: never-tiers never interrupt; session-tiers once per session and never after a T1',
        (_state, _l, session, d) => {
            if (!d.interrupt || d.interrupt === session.openInterrupt) return
            const budget = budgetOf(askOf(d.interrupt))
            expect(budget).not.toBe('never')
            if (budget === 'session') expect(session.interruptsThisSession).toEqual([])
        }
    )

    check(
        'announcements: only from the third session, with Home idle and no announcement in 7 days',
        (state, ledger, session, d) => {
            if (!d.interrupt || d.interrupt === session.openInterrupt) return
            const chosen = askOf(d.interrupt)
            if (budgetOf(chosen) !== 'quiet') return
            expect(session.count).toBeGreaterThanOrEqual(QUIET_SESSION_MIN_COUNT)
            expect(session.interruptsThisSession).toEqual([])
            const liveZone = live(state, ledger, d).filter((ask) => ask.tier <= 5 && ask.surfaces.includes('zone'))
            expect(liveZone.map((a) => a.id)).toEqual([])
            const lastShow = ASKS.filter((ask) => ask.tier === chosen.tier)
                .flatMap((ask) => ledger[ask.id]?.shownAt ?? [])
                .map((at) => Date.parse(at))
                .filter(Number.isFinite)
            for (const at of lastShow) expect(NOW - at).toBeGreaterThanOrEqual(ANNOUNCEMENT_COOLDOWN_DAYS * DAY_MS)
        }
    )
})

// ---------- D/E: the Home card ----------

describe('D–E. the Home zone', () => {
    check('off Home there is no card', (_s, _l, session, d) => {
        if (session.route !== 'home') expect(d.zone).toBeNull()
    })

    check('the card is a live zone ask (or a pending one in status mode)', (state, ledger, _session, d) => {
        if (!d.zone) return
        const ask = askOf(d.zone.id)
        expect(ask.surfaces).toContain('zone')
        if (d.zone.mode === 'ask') expect(live(state, ledger, d).map((a) => a.id)).toContain(d.zone.id)
        else expect(d.trace.verdicts[d.zone.id]).toBe('pending')
    })

    check('while the to-do list is live, only the list or a higher tier holds Home', (state, ledger, _session, d) => {
        if (!d.zone || d.zone.mode !== 'ask') return
        const anchor = anchorOf(live(state, ledger, d))
        if (!anchor) return
        if (d.zone.id !== anchor.id) {
            expect(askOf(d.zone.id).tier).toBeLessThan(anchor.tier)
            expect(d.zone.underlay).toBe(anchor.id)
        }
    })

    check('no lower card while a card that outranks it is still loading', (_state, _l, session, d) => {
        if (!d.zone || session.settleDeadlinePassed) return
        const chosen = askOf(d.zone.id)
        const loading = ASKS.filter(
            (ask) => ask.surfaces.includes('zone') && d.trace.verdicts[ask.id] === 'unknown' && outranks(ask, chosen)
        )
        expect(loading.map((a) => a.id)).toEqual([])
    })
})

// ---------- inline + banner ----------

describe('inline notice and banner', () => {
    check('the inline notice is a live inline ask whose slot is on screen', (state, ledger, session, d) => {
        if (!d.inline) return
        const ask = askOf(d.inline.id)
        expect(ask.surfaces).toContain('inline')
        expect(ask.slots).toContain(d.inline.slot)
        expect(session.slots.map((s) => s.id)).toContain(d.inline.slot)
        expect(live(state, ledger, d).map((a) => a.id)).toContain(d.inline.id)
    })

    check('the banner is the highest live banner ask', (state, ledger, session, d) => {
        if (session.gateUp) return
        expect(d.banner).toBe(live(state, ledger, d).find((ask) => ask.surfaces.includes('banner'))?.id ?? null)
    })
})

// ---------- F: silence and the ledger ----------

describe('F. silence and the ledger', () => {
    check('a dismissed or snoozed ask is never picked anywhere', (state, ledger, _session, d) => {
        for (const id of [d.interrupt, d.zone?.mode === 'ask' ? d.zone.id : null, d.inline?.id, d.banner]) {
            if (id) expect(isSilenced(askOf(id), ledger[id], state)).toBe(false)
        }
    })

    test('a new version re-arms a dismissal; the same version keeps it silent', () => {
        fc.assert(
            fc.property(stateArb, (state) => {
                for (const ask of ASKS) {
                    const version = ask.version?.(state)
                    if (version === undefined) continue
                    const dismissed = { dismissedAt: iso(-1), version }
                    if (ask.policy.expiryDays === undefined) expect(isSilenced(ask, dismissed, state)).toBe(true)
                    expect(isSilenced(ask, { ...dismissed, version: `${version}-old` }, state)).toBe(false)
                }
            }),
            { numRuns: 500 }
        )
    })

    test('a snooze holds until its date, then lets go', () => {
        fc.assert(
            fc.property(fc.constantFrom(...ASKS), fc.integer({ min: 1, max: 60 }), stateArb, (ask, days, state) => {
                const entry = { snoozedUntil: iso(days), version: ask.version?.(state) }
                expect(isSilenced(ask, entry, state)).toBe(true)
                expect(isSilenced(ask, entry, { ...state, now: NOW + (days + 1) * DAY_MS })).toBe(false)
            }),
            { numRuns: 500 }
        )
    })

    test('merging two devices: the newer write of an ask wins, nothing newer is lost, merge is idempotent', () => {
        fc.assert(
            fc.property(ledgerArb, ledgerArb, (a, b) => {
                const merged = mergeLedgers(a, b)
                expect(mergeLedgers(merged, b)).toEqual(merged)
                for (const id of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<AskId>) {
                    const stampA = Date.parse(a[id]?.updatedAt ?? '') || 0
                    const stampB = Date.parse(b[id]?.updatedAt ?? '') || 0
                    const newest = Math.max(stampA, stampB)
                    if (newest > 0) expect(Date.parse(merged[id]?.updatedAt ?? '') || 0).toBe(newest)
                }
            }),
            { numRuns: 1000 }
        )
    })
})

// ---------- E: many sessions ----------

describe('E. over many sessions (simulator)', () => {
    // An activated user on Home with several growth and repeat-use cards live and nothing else.
    const quietHome = {
        activated: true,
        onboarding: {
            verify: 'done',
            addMoneyDone: true,
            firstPaymentDone: true,
            firstPaymentRoute: 'card_qr',
            step: 'completed',
        },
        route: 'home',
        consent: { status: 'clear', versions: [], documents: [] },
        userId: 'user-a',
        userLoaded: true,
        arrival: 'none',
        push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
        balance: { loaded: true, usd: 0 },
        card: { loaded: true, needsSetup: false, activeCardId: null },
        cardOffer: { loaded: true, geoProhibited: true, hasCardRelationship: false, promotionDisabled: false },
        qr: { canPayNow: false, hasMadeQrPayment: true, verifyOpensQr: false },
        depositAccounts: { enabled: false, loaded: true, claimable: 0, active: 0 },
        showEarlyUserModal: false,
        // tier-1/2 Home cards never rotate (they hold Home until dealt with); keep them out
        dueTasks: 0,
        blockedCardId: null,
        migration: { on: false },
    }

    function simulate(
        state: JourneyState,
        sessions: number,
        onShow?: (id: AskId, session: number, ledger: Ledger) => Ledger
    ) {
        let ledger: Ledger = {}
        const picks: (AskId | null)[] = []
        for (let count = 1; count <= sessions; count++) {
            const session: Session = {
                slots: [],
                count,
                route: 'home',
                interruptsThisSession: [],
                openInterrupt: null,
                busy: false,
                gateUp: false,
                settleDeadlinePassed: true,
            }
            const d = decide({ ...state, now: NOW + count * DAY_MS }, ASKS, ledger, session)
            const id = d.zone?.id ?? null
            picks.push(id)
            if (id) {
                // what the provider records when a card is on screen (ledgerActions.shown, surface zone)
                const entry = ledger[id] ?? {}
                const consecutive = entry.lastSessionShown === count - 1 ? (entry.consecutiveSessions ?? 0) + 1 : 1
                ledger = { ...ledger, [id]: { ...entry, lastSessionShown: count, consecutiveSessions: consecutive } }
                if (onShow) ledger = onShow(id, count, ledger)
            }
        }
        return picks
    }

    test('no live card starves: every one shows within a bounded number of sessions', () => {
        fc.assert(
            fc.property(stateArb, fc.integer({ min: 12, max: 30 }), (generated, sessions) => {
                const state = { ...generated, ...quietHome } as unknown as JourneyState
                const picks = simulate(state, sessions)
                const firstDecision = decide(
                    state,
                    ASKS,
                    {},
                    {
                        slots: [],
                        count: 1,
                        route: 'home',
                        interruptsThisSession: [],
                        openInterrupt: null,
                        busy: false,
                        gateUp: false,
                        settleDeadlinePassed: true,
                    }
                )
                if (firstDecision.zone && askOf(firstDecision.zone.id).tier < 3) return
                const liveCards = firstDecision.trace.candidates.filter(
                    (id) => askOf(id).surfaces.includes('zone') && askOf(id).tier >= 3
                )
                // with k live rotating cards, the top one yields one session in every MAX+1
                const shown = new Set(picks.filter(Boolean))
                if (liveCards.length >= 2) expect(shown.size).toBeGreaterThanOrEqual(2)
                for (let i = 0; i + DEFAULT_MAX_CONSECUTIVE_SESSIONS < picks.length; i++) {
                    const run = picks.slice(i, i + DEFAULT_MAX_CONSECUTIVE_SESSIONS + 1)
                    if (liveCards.length >= 2 && run.every((id) => id === run[0]) && run[0])
                        throw new Error(`${run[0]} held Home ${run.length} sessions in a row: ${picks.join(',')}`)
                }
            }),
            { numRuns: 400 }
        )
    })

    test('with three or more live cards, every one gets Home within a bounded number of sessions', () => {
        fc.assert(
            fc.property(fc.integer({ min: 3, max: 4 }), (k) => {
                // growth cards only: invite (T5·1), rewards (T5·2), complete profile (T5·4), bug bounty (T5·5)
                const state = {
                    ...quietHome,
                    now: NOW,
                    invitesSent: 0,
                    rewardsPendingUsd: k >= 3 ? 5 : 0,
                    hasFullName: false,
                    hasSupportSurvivorBadge: k < 4,
                    hasEmail: true,
                    passkeyCount: null,
                    firstPeerPaymentAt: iso(-30),
                    hasReceivedRequestPayment: true,
                    lastSpendAt: iso(-1),
                    flags: { userInterview: false },
                    documentSlideKey: null,
                    capNudge: null,
                    maintenance: 'none',
                    isNative: false,
                    geoCountry: 'US',
                    identity: {
                        status: 'verified',
                        isVerified: true,
                        needsAction: false,
                        isTerminalFailure: false,
                        isRegionRestricted: false,
                    },
                    postAuthRedirect: false,
                    postAuthRedirectDestination: null,
                    serverLedger: undefined,
                } as unknown as JourneyState
                const sessions = k * (DEFAULT_MAX_CONSECUTIVE_SESSIONS + 1) * 2
                const picks = simulate(state, sessions)
                const first = decide(
                    state,
                    ASKS,
                    {},
                    {
                        slots: [],
                        count: 1,
                        route: 'home',
                        interruptsThisSession: [],
                        openInterrupt: null,
                        busy: false,
                        gateUp: false,
                        settleDeadlinePassed: true,
                    }
                )
                const liveCards = first.trace.candidates.filter(
                    (id) => askOf(id).surfaces.includes('zone') && askOf(id).tier >= 3
                )
                expect(liveCards.length).toBeGreaterThanOrEqual(3)
                const never = liveCards.filter((id) => !picks.includes(id))
                expect({ never, picks }).toEqual({ never: [], picks })
            }),
            { numRuns: 20 }
        )
    })

    test('a dismissed card never comes back; the next card takes Home', () => {
        fc.assert(
            fc.property(stateArb, (generated) => {
                const state = { ...generated, ...quietHome } as unknown as JourneyState
                const dismissedAtSession = new Map<AskId, number>()
                const picks = simulate(state, 12, (id, count, ledger) => {
                    if (count % 3 !== 1 || dismissedAtSession.has(id)) return ledger
                    dismissedAtSession.set(id, count)
                    return {
                        ...ledger,
                        [id]: { ...ledger[id], dismissedAt: new Date(NOW + count * DAY_MS).toISOString() },
                    }
                })
                picks.forEach((id, i) => {
                    const at = id ? dismissedAtSession.get(id) : undefined
                    if (id && at !== undefined && i + 1 > at && askOf(id).policy.expiryDays === undefined)
                        throw new Error(
                            `${id} came back in session ${i + 1} after its dismissal in session ${at}: ${picks.join(',')}`
                        )
                })
            }),
            { numRuns: 300 }
        )
    })
})
