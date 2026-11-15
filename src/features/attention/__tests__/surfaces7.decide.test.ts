import { decide } from '../decide'
import { ASKS } from '../registry'
import type { AttentionAsk, JourneyState, Ledger, Session } from '../types'

const NOW = Date.parse('2026-10-12T12:00:00Z')
const DEADLINE = '2026-11-01T00:00:00.000Z'
const state = (overrides: Record<string, unknown> = {}): JourneyState =>
    ({
        now: NOW,
        userId: 'user-a',
        userLoaded: true,
        isNative: true,
        route: 'home',
        consent: { status: 'clear', versions: [], documents: [] },
        identity: {
            status: 'approved',
            isVerified: true,
            needsAction: false,
            isTerminalFailure: false,
            isRegionRestricted: false,
        },
        onboarding: {
            verify: 'done',
            addMoneyDone: true,
            firstPaymentDone: true,
            firstPaymentRoute: 'card_qr',
            step: 'completed',
        },
        blockedCardId: null,
        dueTasks: 0,
        card: { loaded: true, needsSetup: false, activeCardId: null },
        postAuthRedirect: false,
        postAuthRedirectDestination: null,
        balance: { loaded: true, usd: 0 },
        migration: { on: false },
        push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
        showEarlyUserModal: false,
        activated: true,
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
        capNudge: null,
        maintenance: 'none',
        ...overrides,
    }) as unknown as JourneyState

const session = (overrides: Record<string, unknown> = {}): Session =>
    ({
        count: 3,
        route: 'home',
        interruptsThisSession: [],
        openInterrupt: null,
        busy: false,
        gateUp: false,
        settleDeadlinePassed: false,
        slots: [],
        ...overrides,
    }) as unknown as Session

type PickDecision = ReturnType<typeof decide> & {
    inline: { id: string; slot: string } | null
    banner: string | null
}
const ask = (id: string, overrides: Record<string, unknown> = {}): AttentionAsk =>
    ({
        id,
        tier: 3,
        rank: 1,
        surfaces: ['inline'],
        slots: ['bank-transfer'],
        eligible: () => 'show',
        policy: {},
        analyticsKey: id,
        ...overrides,
    }) as unknown as AttentionAsk
const run = (asks: AttentionAsk[], overrides: Record<string, unknown> = {}, ledger: Ledger = {}) =>
    decide(state(), asks, ledger, session(overrides)) as PickDecision
const lookup = (id: string) => ASKS.find((candidate) => candidate.id === id)
const twoSlots = [{ id: 'limits' }, { id: 'bank-transfer', context: { advisoryDeadline: DEADLINE } }]

describe('phase 7 inline decisions', () => {
    test.each([
        ['tier outranks rank', { tier: 2, rank: 99 }, { tier: 3, rank: 0 }],
        ['rank breaks a tier tie', { tier: 3, rank: 1 }, { tier: 3, rank: 2 }],
    ])('one notice across two mounted slots: %s', (_label, winner, loser) => {
        const d = run([ask('cap-nudge', { ...loser, slots: ['limits'] }), ask('verification-deadline', winner)], {
            slots: twoSlots,
        })
        // "At most one inline notice per screen, across all mounted slots."
        expect(d.inline).toEqual({ id: 'verification-deadline', slot: 'bank-transfer' })
    })

    test.each([
        [[{ id: 'limits' }, { id: 'bank-transfer' }], 'limits'],
        [[{ id: 'bank-transfer' }, { id: 'limits' }], 'bank-transfer'],
    ])('uses mount order rather than the ask slot order: %j', (slots, expectedSlot) => {
        const d = run([ask('verification-deadline', { slots: ['bank-transfer', 'limits'] })], { slots })
        // "first matching mounted slot in mount order"
        expect(d.inline).toEqual({ id: 'verification-deadline', slot: expectedSlot })
    })

    test.each([
        ['valid context', { advisoryDeadline: DEADLINE }, true],
        ['missing context', undefined, false],
        ['null deadline', { advisoryDeadline: null }, false],
        ['garbage deadline', { advisoryDeadline: 'not-a-date' }, false],
    ])('slotWhen gates %s and records refusals', (_label, context, allowed) => {
        const candidate = ask('verification-deadline', {
            policy: {
                slotWhen: (_s: JourneyState, ctx: Record<string, unknown> | undefined) =>
                    typeof ctx?.advisoryDeadline === 'string' && !Number.isNaN(Date.parse(ctx.advisoryDeadline)),
            },
        })
        const d = run([candidate], { slots: [{ id: 'bank-transfer', context }] })
        // "whose policy.slotWhen (if any) returns true for that slot's context"
        expect(d.inline).toEqual(allowed ? { id: 'verification-deadline', slot: 'bank-transfer' } : null)
        if (!allowed) {
            // "failed slotWhen ('slot condition')"
            expect(d.trace.reasons['verification-deadline' as keyof typeof d.trace.reasons]).toBe('slot condition')
        }
    })

    test('without slotWhen a mounted slot needs no context', () => {
        // "whose policy.slotWhen (if any) returns true for that slot's context"
        expect(run([ask('cap-nudge', { slots: ['limits'] })], { slots: [{ id: 'limits' }] }).inline).toEqual({
            id: 'cap-nudge',
            slot: 'limits',
        })
    })

    test.each([[], [{ id: 'limits' }]])('no matching mounted slot records no slot on screen: %j', (...slots) => {
        const d = run([ask('verification-deadline')], { slots })
        // "an inline candidate that had no mounted slot ('no slot on screen')"
        expect(d.inline).toBeNull()
        // "an inline candidate that had no mounted slot ('no slot on screen')"
        expect(d.trace.reasons['verification-deadline' as keyof typeof d.trace.reasons]).toBe('no slot on screen')
    })

    test('a refused higher candidate yields to the next eligible notice', () => {
        const d = run(
            [
                ask('verification-deadline', { policy: { slotWhen: () => false } }),
                ask('cap-nudge', { rank: 2, slots: ['limits'] }),
            ],
            { slots: twoSlots }
        )
        // "the first one that has a slot in session.slots ... and whose policy.slotWhen (if any) returns true"
        expect(d.inline).toEqual({ id: 'cap-nudge', slot: 'limits' })
    })

    test('the interrupt and inline never share an ask', () => {
        const d = run(
            [
                ask('legal-reconsent', { tier: 1, surfaces: ['interrupt', 'inline'], presentation: 'modal' }),
                ask('cap-nudge', { slots: ['limits'] }),
            ],
            { slots: twoSlots }
        )
        // "Interrupt: unchanged."
        expect(d.interrupt).toBe('legal-reconsent')
        // "An ask cannot be both the interrupt and the inline pick."
        expect(d.inline).toEqual({ id: 'cap-nudge', slot: 'limits' })
        // "An ask cannot be both the interrupt and the inline pick."
        expect(d.inline?.id).not.toBe(d.interrupt)
    })

    test('inline ignores interrupt budget, zone rotation and the settle hold', () => {
        const d = run(
            [
                ask('legal-reconsent', { tier: 1, surfaces: ['interrupt'], eligible: () => 'unknown' }),
                ask('cap-nudge', {
                    tier: 6,
                    slots: ['limits'],
                    policy: { interrupt: 'never', minSessions: 99, maxConsecutiveSessions: 1 },
                }),
            ],
            { slots: twoSlots, count: 1, interruptsThisSession: ['balance-backup'] },
            { 'cap-nudge': { lastSessionShown: 0, consecutiveSessions: 99 } } as Ledger
        )
        // "Inline picks have no budget, no rotation and no settle hold."
        expect(d.inline).toEqual({ id: 'cap-nudge', slot: 'limits' })
    })
})

describe('phase 7 banners and suspension', () => {
    const allSurfaces = () => [
        ask('legal-reconsent', { tier: 1, surfaces: ['interrupt'], presentation: 'modal' }),
        ask('checklist', { tier: 2, surfaces: ['zone'] }),
        ask('verification-deadline'),
        ask('maintenance', { tier: 1, rank: 0, surfaces: ['banner'] }),
    ]

    test('banner picks the first live candidate by tier then rank', () => {
        const d = run([
            ask('invite', { tier: 1, rank: 0, surfaces: ['banner'], eligible: () => 'done' }),
            ask('bug-bounty', { tier: 2, rank: 0, surfaces: ['banner'] }),
            ask('maintenance', { tier: 1, rank: 2, surfaces: ['banner'] }),
            ask('early-user', { tier: 1, rank: 1, surfaces: ['banner'] }),
        ])
        // "Banner: the first live ask with 'banner' in surfaces, tier-then-rank."
        expect(d.banner).toBe('early-user')
    })

    test.each(['interrupt', 'zone', 'inline'])(
        'banner is independent of the %s pick, including the same ask',
        (surface) => {
            const d = run([ask('maintenance', { tier: 1, surfaces: [surface, 'banner'], presentation: 'modal' })], {
                slots: twoSlots,
            })
            // "Independent of interrupt, zone and inline."
            expect(surface === 'inline' ? d.inline?.id : surface === 'zone' ? d.zone?.id : d.interrupt).toBe(
                'maintenance'
            )
            // "Independent of interrupt, zone and inline."
            expect(d.banner).toBe('maintenance')
        }
    )

    test('busy blocks a new interrupt while keeping the other three picks', () => {
        const d = run(allSurfaces(), { busy: true, slots: twoSlots })
        // "busy ... now only stops a NEW interrupt from opening."
        expect(d.interrupt).toBeNull()
        // "It no longer clears the zone, inline or banner picks."
        expect(d.zone).toEqual({ id: 'checklist', mode: 'ask' })
        // "It no longer clears the zone, inline or banner picks."
        expect(d.inline).toEqual({ id: 'verification-deadline', slot: 'bank-transfer' })
        // "It no longer clears the zone, inline or banner picks."
        expect(d.banner).toBe('maintenance')
        // "suspended stays true while busy"
        expect(d.suspended).toBe(true)
    })

    test('busy keeps an already-open interrupt and the other picks', () => {
        const d = run(allSurfaces(), { busy: true, openInterrupt: 'legal-reconsent', slots: twoSlots })
        // "busy ... now only stops a NEW interrupt from opening."
        expect(d.interrupt).toBe('legal-reconsent')
        // "It no longer clears the zone, inline or banner picks."
        expect([d.zone?.id, d.inline?.id, d.banner]).toEqual(['checklist', 'verification-deadline', 'maintenance'])
        // "suspended stays true while busy"
        expect(d.suspended).toBe(true)
    })

    test.each([false, true])('gateUp clears every pick including an open interrupt (busy=%s)', (busy) => {
        const d = run(allSurfaces(), { gateUp: true, busy, openInterrupt: 'legal-reconsent', slots: twoSlots })
        // "gateUp still clears everything."
        expect({
            interrupt: d.interrupt,
            zone: d.zone,
            inline: d.inline,
            banner: d.banner,
            suspended: d.suspended,
        }).toEqual({ interrupt: null, zone: null, inline: null, banner: null, suspended: true })
    })
})

describe('phase 7 registry contracts', () => {
    test('every interrupt ask declares a presentation', () => {
        const interrupts = ASKS.filter((candidate) => candidate.surfaces.includes('interrupt'))
        // "A registry test asserts every interrupt ask declares a presentation."
        expect(interrupts.length).toBeGreaterThan(0)
        for (const candidate of interrupts) {
            // "A registry test asserts every interrupt ask declares a presentation."
            expect(['modal', 'drawer']).toContain((candidate as AttentionAsk & { presentation?: string }).presentation)
        }
    })

    test.each([
        ['legal-reconsent', 'modal'],
        ['balance-backup', 'drawer'],
        ['post-verification-action', 'modal'],
        ['finish-card-setup', 'modal'],
        ['install-app', 'modal'],
        ['push-home-fallback', 'modal'],
        ['early-user', 'drawer'],
    ])('%s preserves today’s %s presentation', (id, presentation) => {
        // "Every interrupt ask in registry.ts gets presentation, matching today's look exactly"
        expect(lookup(id)).toEqual(expect.objectContaining({ presentation }))
    })

    test('every inline ask declares slots', () => {
        const inline = ASKS.filter((candidate) => (candidate.surfaces as string[]).includes('inline'))
        // "required when surfaces include 'inline': the page slots this notice may fill"
        expect(inline.length).toBeGreaterThan(0)
        for (const candidate of inline) {
            // "required when surfaces include 'inline': the page slots this notice may fill"
            expect((candidate as AttentionAsk & { slots?: string[] }).slots?.length).toBeGreaterThan(0)
        }
    })

    test.each([
        ['verification-deadline', 3, 1, ['inline'], ['bank-transfer']],
        ['cap-nudge', 3, 2, ['inline'], ['limits']],
        ['maintenance', 1, 0, ['banner'], undefined],
    ])('%s has the specified tier, rank and surface', (id, tier, rank, surfaces, slots) => {
        // "verification-deadline (T3 · 1)"; "cap-nudge (T3 · 2)"; "Ask maintenance (T1 · 0)"
        expect(lookup(id as string)).toEqual(expect.objectContaining({ tier, rank, surfaces }))
        if (slots) {
            // "slots: ['bank-transfer']"; "slots: ['limits']"
            expect(lookup(id as string)).toEqual(expect.objectContaining({ slots }))
        }
    })

    test.each([
        ['valid ISO deadline', DEADLINE, true],
        ['null', null, false],
        ['garbage string', 'garbage', false],
    ])('verification-deadline eligibility and slot gate: %s', (_label, advisoryDeadline, expected) => {
        const candidate = lookup('verification-deadline')
        // "eligible 'show' for a loaded user"
        expect(candidate?.eligible(state())).toBe('show')
        const d = decide(
            state(),
            candidate ? [candidate] : [],
            {},
            session({ slots: [{ id: 'bank-transfer', context: { advisoryDeadline } }] })
        ) as PickDecision
        // "typeof ctx?.advisoryDeadline === 'string' && !Number.isNaN(Date.parse(ctx.advisoryDeadline))"
        expect(d.inline).toEqual(expected ? { id: 'verification-deadline', slot: 'bank-transfer' } : null)
    })

    test.each([
        ['non-null', { kind: 'verify', title: 'Verify' }, 'show'],
        ['null', null, 'ineligible'],
        ['undefined', undefined, 'unknown'],
    ])('cap-nudge eligibility: %s', (_label, capNudge, expected) => {
        // "eligible when journey state capNudge is not null ... 'unknown' while capabilities load"
        expect(lookup('cap-nudge')?.eligible(state({ capNudge }))).toBe(expected)
    })

    test.each([
        ['none', 'ineligible'],
        ['scoped', 'show'],
        ['full', 'show'],
    ])('maintenance eligibility: %s', (maintenance, expected) => {
        // "eligible from journey state maintenance: 'none' | 'scoped' | 'full' ('show' unless 'none')"
        expect(lookup('maintenance')?.eligible(state({ maintenance }))).toBe(expected)
    })
})
