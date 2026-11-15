/** Phase 8 §1: the live to-do list anchors Home; only a higher tier may overlay it. */
import { decide } from '../decide'
import { ASKS, BALANCE_WARNING_THRESHOLD_USD } from '../registry'
import type { AskId, AttentionAsk, JourneyState, Ledger, Session, Tier } from '../types'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import { selectHomeTasks } from '@/utils/bridge-tasks.utils'
import type { NextAction } from '@/types/capabilities'

const NOW = Date.parse('2026-10-12T12:00:00Z')
const onboarding = (completed = false) => ({
    verify: completed ? ('done' as const) : ('todo' as const),
    addMoneyDone: completed,
    firstPaymentDone: completed,
    firstPaymentRoute: 'card_qr' as const,
    step: completed ? ('completed' as const) : ('verify' as const),
})

const state = (patch: Partial<JourneyState> = {}): JourneyState => ({
    capNudge: null,
    maintenance: 'none',
    now: NOW,
    userId: 'user-a',
    userLoaded: true,
    isNative: true,
    deviceType: 'ios',
    route: 'home',
    consent: { status: 'clear', versions: [], documents: [] },
    identity: {
        status: 'not_started',
        isVerified: false,
        needsAction: false,
        isTerminalFailure: false,
        isRegionRestricted: false,
    },
    onboarding: onboarding(),
    blockedCardId: null,
    dueTasks: 0,
    card: { loaded: true, needsSetup: false, activeCardId: null, setupPath: 'none', needsFunding: false },
    postAuthRedirect: false,
    postAuthRedirectDestination: null,
    balance: { loaded: true, usd: 0 },
    migration: { on: false },
    push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
    showEarlyUserModal: false,
    activated: false,
    geoCountry: 'US',
    invitesSent: 1,
    hasSupportSurvivorBadge: true,
    cardOffer: { loaded: true, geoProhibited: false, hasCardRelationship: true, promotionDisabled: false },
    qr: { canPayNow: false, hasMadeQrPayment: false, verifyOpensQr: false },
    documentSlideKey: null,
    flags: { userInterview: false },
    depositAccounts: { enabled: false, loaded: true, claimable: 0, active: 0 },
    lastSpendAt: null,
    hasReceivedRequestPayment: true,
    firstPeerPaymentAt: '2026-09-01T00:00:00.000Z',
    passkeyCount: null,
    hasEmail: true,
    hasFullName: true,
    rewardsPendingUsd: 0,
    serverLedger: undefined,
    arrival: 'none',
    ...patch,
})

const baseSession: Session = {
    count: 3,
    route: 'home',
    interruptsThisSession: [],
    openInterrupt: null,
    busy: false,
    gateUp: false,
    settleDeadlinePassed: false,
    slots: [],
}

const run = (patch: Partial<JourneyState> = {}, session: Partial<Session> = {}, ledger: Ledger = {}) =>
    decide(state(patch), ASKS, ledger, { ...baseSession, ...session })

const WEB_INSTALL: Partial<JourneyState> = { isNative: false, migration: { on: true } }
const BLOCKED = 'blocked-card:verification-issue:provider_rejected'

describe('Phase 8: Home anchor selection', () => {
    test.each([8, 30])('a document advisory %i days before due is visible over the checklist', (days) => {
        const action: NextAction = {
            key: 'document',
            kind: 'sumsub',
            purpose: 'unlock-bridge',
            effectiveDate: new Date(NOW + days * 86400000).toISOString(),
        }
        const capabilities = withFeatureReport({ rails: [], nextActions: [action] })
        capabilities.features!.bank.accounts = { USD: { state: 'on', action: action.key } }
        const tasks = selectHomeTasks([action], capabilities.features, new Date(NOW))
        expect(tasks.documentSlide?.key).toBe(action.key)
        const decision = run({ documentSlideKey: tasks.documentSlide?.key ?? null })
        expect(decision.zone).toEqual({ id: 'verification-advisory', mode: 'ask', underlay: 'checklist' })
        expect(run({ documentSlideKey: action.key, dueTasks: 1 }).zone).toEqual({
            id: 'verification-due',
            mode: 'ask',
            underlay: 'checklist',
        })
    })
    test.each<AskId>(['checklist', 'blocked-card'])('%s is registered as a Home anchor', (id) => {
        expect(ASKS.find((ask) => ask.id === id)?.policy.anchorsHome).toBe(true)
    })

    test('the install-app card cannot replace the live checklist, even with a better same-tier rank', () => {
        const d = run(WEB_INSTALL)
        expect(d.trace.verdicts['install-app']).toBe('show')
        expect(d.zone).toEqual({ id: 'checklist', mode: 'ask' })
    })

    test('the first live anchor by rank is blocked-card, ahead of checklist and install-app', () => {
        const d = run({ ...WEB_INSTALL, blockedCardId: BLOCKED })
        // the API judges the list without the blocked card; rank alone puts the card first
        expect(d.trace.verdicts.checklist).toBe('show')
        expect(d.zone).toEqual({ id: 'blocked-card', mode: 'ask' })
    })

    test('hiding a still-blocked card hands Home to the to-do list', () => {
        const d = run(
            { ...WEB_INSTALL, blockedCardId: BLOCKED },
            {},
            { 'blocked-card': { dismissedAt: new Date(NOW).toISOString(), version: BLOCKED } }
        )
        expect(d.zone).toEqual({ id: 'checklist', mode: 'ask' })
        // install-app is tier 1 (Slava, 2026-10-12): the most critical ask may open over the list
        expect(d.interrupt).toBe('install-app')
    })

    test('a hidden blocked card with a new reason takes Home back from the list', () => {
        const d = run(
            { ...WEB_INSTALL, blockedCardId: 'blocked-card:verification-issue:duplicate_account' },
            {},
            { 'blocked-card': { dismissedAt: new Date(NOW).toISOString(), version: BLOCKED } }
        )
        expect(d.zone).toEqual({ id: 'blocked-card', mode: 'ask' })
    })

    test.each<AskId>(['checklist', 'blocked-card'])('a T1 zone pick keeps %s as its underlay', (anchor) => {
        const d = run({ dueTasks: 1, ...(anchor === 'blocked-card' ? { blockedCardId: BLOCKED } : {}) })
        expect(d.zone).toEqual({ id: 'verification-due', mode: 'ask', underlay: anchor })
    })

    test('a dismissed T1 zone ask yields back to the anchor without an underlay', () => {
        const d = run({ dueTasks: 1 }, {}, { 'verification-due': { dismissedAt: new Date(NOW).toISOString() } })
        expect(d.zone).toEqual({ id: 'checklist', mode: 'ask' })
    })

    test.each<Tier>([1, 2, 3, 4, 5, 6])('zone tier %i respects the strict anchor boundary', (tier) => {
        const anchor = ASKS.find((ask) => ask.id === 'checklist')!
        const challenger: AttentionAsk = {
            id: 'invite',
            tier,
            rank: -10,
            surfaces: ['zone'],
            eligible: () => 'show',
            policy: {},
            analyticsKey: 'tier-boundary',
        }
        const d = decide(state(), [challenger, anchor], {}, baseSession)
        expect(d.zone).toEqual(
            tier === 1 ? { id: 'invite', mode: 'ask', underlay: 'checklist' } : { id: 'checklist', mode: 'ask' }
        )
    })

    test('critical zone candidates and multiple anchors are ordered by tier then rank, not input order', () => {
        const anchor = ASKS.find((ask) => ask.id === 'checklist')!
        const makeAsk = (id: AskId, tier: Tier, rank: number, anchorsHome = false): AttentionAsk => ({
            id,
            tier,
            rank,
            surfaces: ['zone'],
            eligible: () => 'show',
            policy: { anchorsHome },
            analyticsKey: id,
        })
        const d = decide(
            state(),
            [
                makeAsk('invite', 3, 0, true),
                makeAsk('finish-card-setup', 1, 5),
                anchor,
                makeAsk('verification-due', 1, 3),
            ],
            {},
            baseSession
        )
        expect(d.zone).toEqual({ id: 'verification-due', mode: 'ask', underlay: 'checklist' })
    })

    test('fatigue never rotates away the T2 anchor or its T1 overlay', () => {
        const resting = { lastSessionShown: 2, consecutiveSessions: 10 }
        const ledger: Ledger = { checklist: resting, 'verification-due': resting }
        expect(run({}, {}, ledger).zone).toEqual({ id: 'checklist', mode: 'ask' })
        expect(run({ dueTasks: 1 }, {}, ledger).zone).toEqual({
            id: 'verification-due',
            mode: 'ask',
            underlay: 'checklist',
        })
    })

    test('unknown checklist holds a lower card until the settle deadline', () => {
        const patch = { onboarding: null, activated: true, invitesSent: 0 }
        expect(run(patch).zone).toBeNull()
        expect(run(patch, { settleDeadlinePassed: true }).zone).toEqual({ id: 'invite', mode: 'ask' })
    })

    test('after activation, no anchor changes the install-app zone fallback', () => {
        // a user-opened overlay blocks new interrupts, so the tier 1 install ask takes the card
        const d = run({ ...WEB_INSTALL, activated: true, onboarding: onboarding(true) }, { busy: true })
        expect(d.zone).toEqual({ id: 'install-app', mode: 'ask' })
    })
})

describe('Phase 8: Home interrupt anchor boundary', () => {
    test('install-app is the most critical ask: it opens over the to-do list, its card overlays it', () => {
        expect(run(WEB_INSTALL).interrupt).toBe('install-app')
        expect(run(WEB_INSTALL, { busy: true }).zone).toEqual({ id: 'install-app', mode: 'ask', underlay: 'checklist' })
    })

    test('an announcement is refused on Home with the to-do-list trace reason', () => {
        const d = run({ showEarlyUserModal: true })
        expect(d.trace.verdicts['early-user']).toBe('show')
        expect(d.interrupt).toBeNull()
        expect(d.trace.reasons['early-user']).toBe('held by the to-do list')
        expect(d.zone).toEqual({ id: 'checklist', mode: 'ask' })
    })

    test('the push pre-prompt opens over the to-do list, which keeps the card', () => {
        const d = run({ push: { ready: true, unanswered: true, promptedThisSession: false, notEnabled: true } })
        expect(d.interrupt).toBe('push-home-fallback')
        expect(d.zone).toEqual({ id: 'checklist', mode: 'ask' })
    })

    test('the push pre-prompt still keeps to its budget: none after a tier 1 interrupt this session', () => {
        const d = run(
            { push: { ready: true, unanswered: true, promptedThisSession: false, notEnabled: true } },
            { interruptsThisSession: ['legal-reconsent'] }
        )
        expect(d.interrupt).toBeNull()
        expect(d.trace.reasons['push-home-fallback']).toBe('budget: a T1 interrupt already fired this session')
    })

    test.each<[AskId, Partial<JourneyState>]>([
        ['legal-reconsent', { consent: { status: 'needed', versions: ['2026-10-12'], documents: [] } }],
        ['balance-backup', { balance: { loaded: true, usd: BALANCE_WARNING_THRESHOLD_USD + 1 } }],
        [
            'post-verification-action',
            {
                identity: { ...state().identity, isVerified: true },
                postAuthRedirect: true,
                postAuthRedirectDestination: '/claim/abc',
            },
        ],
        [
            'finish-card-setup',
            {
                card: {
                    loaded: true,
                    needsSetup: true,
                    activeCardId: 'card-a',
                    setupPath: 'legacy',
                    needsFunding: false,
                },
            },
        ],
    ])('%s follows its normal T1 budget even after another T1 interrupt', (id, patch) => {
        const prior: AskId = id === 'legal-reconsent' ? 'balance-backup' : 'legal-reconsent'
        expect(run(patch, { interruptsThisSession: [prior] }).interrupt).toBe(id)
    })

    test('an already-open T2 interrupt stays sticky while an anchor is live', () => {
        const d = run(WEB_INSTALL, { openInterrupt: 'install-app' })
        expect(d.interrupt).toBe('install-app')
        expect(d.zone).toEqual({ id: 'checklist', mode: 'ask' })
    })

    test('a T2 interrupt with routes any can open off Home despite a live checklist', () => {
        const asks = ASKS.map(
            (ask): AttentionAsk =>
                ask.id === 'install-app' ? { ...ask, policy: { ...ask.policy, routes: 'any' } } : ask
        )
        const d = decide(state({ ...WEB_INSTALL, route: 'other' }), asks, {}, { ...baseSession, route: 'other' })
        expect(d.interrupt).toBe('install-app')
        expect(d.zone).toBeNull()
        expect(d.trace.reasons['install-app']).not.toBe('held by the to-do list')
    })

    test('without a live anchor, the install-app interrupt follows its normal budget', () => {
        const d = run({ ...WEB_INSTALL, activated: true, onboarding: onboarding(true) })
        expect(d.interrupt).toBe('install-app')
        expect(d.zone).toBeNull()
    })

    test('a silenced checklist does not hold a same-tier interrupt', () => {
        const d = run(WEB_INSTALL, {}, { checklist: { dismissedAt: new Date(NOW).toISOString() } })
        expect(d.interrupt).toBe('install-app')
    })
})
