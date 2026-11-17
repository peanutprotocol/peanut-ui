import { DEFAULT_CATALOGUE, DEFAULT_SETTINGS, asCatalogue } from '../catalogue'
import { ASKS } from '../registry'
import { isSilenced } from '../decide'
import { homePushTrigger } from '../homePushTrigger'
import { applyServerFacts, applyServerRanking, asServerAttention } from '../serverAttention'
import type { JourneyState } from '../types'

const envelope = (patch: Record<string, unknown> = {}) => ({
    version: 1,
    ranking: DEFAULT_CATALOGUE.map(({ id, tier, rank }) => ({ id, tier, rank })),
    verdicts: {},
    nextAsk: null,
    catalogueVersion: 1,
    catalogue: DEFAULT_CATALOGUE,
    settings: DEFAULT_SETTINGS,
    ...patch,
})

test('CAT.1 the registry reads all serializable policy fields from the generated backend catalogue', () => {
    for (const row of DEFAULT_CATALOGUE) {
        const ask = ASKS.find((entry) => entry.id === row.id)
        expect(ask).toMatchObject({
            id: row.id,
            tier: row.tier,
            rank: row.rank,
            surfaces: row.surfaces,
            analyticsKey: row.analyticsKey,
        })
        expect(ask?.policy).toMatchObject(row.policy)
    }
    expect(ASKS).toHaveLength(DEFAULT_CATALOGUE.length)
})

test('CAT.2 a live backend row changes rank, surfaces, expiry and budget together', () => {
    const catalogue = DEFAULT_CATALOGUE.map((row) =>
        row.id === 'balance-backup'
            ? { ...row, rank: 99, surfaces: ['zone'], policy: { ...row.policy, expiryDays: 2, interrupt: 'never' } }
            : row
    )
    const server = asServerAttention(envelope({ catalogue }))
    expect(server?.catalogue).toBeDefined()
    const ask = applyServerRanking(ASKS, server).find((entry) => entry.id === 'balance-backup')
    expect(ask).toMatchObject({ rank: 99, surfaces: ['zone'], policy: { expiryDays: 2, interrupt: 'never' } })
})

test.each([
    { catalogueVersion: 2 },
    { catalogue: [...DEFAULT_CATALOGUE, DEFAULT_CATALOGUE[0]] },
    { catalogue: DEFAULT_CATALOGUE.map((row) => ({ ...row, tier: 9 })) },
    { settings: { ...DEFAULT_SETTINGS, settleMs: NaN } },
])('CAT.3 malformed or unsupported policy data uses the generated rules', (patch) => {
    const server = asServerAttention(
        envelope({ ranking: [{ id: 'balance-backup', tier: 6, rank: 88 }], verdicts: { invite: 'show' }, ...patch })
    )
    expect(server?.catalogue).toBeUndefined()
    expect(applyServerRanking(ASKS, server).find((entry) => entry.id === 'balance-backup')).toMatchObject({
        tier: 1,
        rank: 3,
        policy: { expiryDays: 21 },
    })
    const state = { userId: 'user-a', userLoaded: true, activated: false, invitesSent: 1 } as JourneyState
    expect(
        applyServerRanking(ASKS, server)
            .find((entry) => entry.id === 'invite')
            ?.eligible(state)
    ).toBe('ineligible')
})

test('B3.2 lifetime history facts replace a misleading latest-50 display window', () => {
    const state = {
        qr: { canPayNow: true, hasMadeQrPayment: false, verifyOpensQr: false },
        firstPeerPaymentAt: null,
        lastSpendAt: null,
        hasReceivedRequestPayment: false,
        onboarding: null,
    } as JourneyState
    const facts = {
        onboarding: null,
        firstPeerPaymentAt: '2026-10-01T12:00:00.000Z',
        lastSpendAt: '2026-11-02T12:00:00.000Z',
        spendHistoryAvailable: true,
        hasMadeQrPayment: true,
        hasReceivedRequestPayment: true,
    }
    const built = applyServerFacts(state, asServerAttention(envelope({ facts })))
    expect(built.qr.hasMadeQrPayment).toBe(true)
    expect(built.lastSpendAt).toBe(facts.lastSpendAt)
    expect(built.firstPeerPaymentAt).toBe(facts.firstPeerPaymentAt)
    expect(built.hasReceivedRequestPayment).toBe(true)
})

test('B3 missing authoritative history remains unknown and never means no QR payment', () => {
    const state = {
        qr: { canPayNow: true, hasMadeQrPayment: false, verifyOpensQr: false },
        onboarding: null,
    } as JourneyState
    const facts = {
        onboarding: null,
        firstPeerPaymentAt: null,
        lastSpendAt: null,
        spendHistoryAvailable: false,
        hasMadeQrPayment: null,
        hasReceivedRequestPayment: null,
    }
    const built = applyServerFacts(state, asServerAttention(envelope({ facts })))
    expect(built.qr.hasMadeQrPayment).toBeUndefined()
    expect(built.hasReceivedRequestPayment).toBeUndefined()
})

describe('the bank deposit fact', () => {
    const facts = {
        onboarding: null,
        firstPeerPaymentAt: null,
        lastSpendAt: null,
        spendHistoryAvailable: true,
        hasMadeQrPayment: true,
        hasReceivedRequestPayment: false,
    }
    const state = {
        userId: 'user-a',
        userLoaded: true,
        qr: { canPayNow: false, hasMadeQrPayment: false, verifyOpensQr: false },
        depositAccounts: { enabled: true, loaded: true, claimable: 0, active: 1 },
        onboarding: null,
    } as JourneyState
    const shareBankDetails = ASKS.find((ask) => ask.id === 'share-bank-details')!

    test.each([
        ['true', { bankDepositReceived: true }, true, 'done'],
        ['false', { bankDepositReceived: false }, false, 'show'],
        ['null', { bankDepositReceived: null }, null, 'show'],
        ['missing', {}, null, 'show'],
        ['not a boolean', { bankDepositReceived: 'yes' }, null, 'show'],
    ])('%s reads as %p and share bank details is %s', (_label, patch, fact, verdict) => {
        const built = applyServerFacts(state, asServerAttention(envelope({ facts: { ...facts, ...patch } })))
        expect(built.bankDepositReceived).toBe(fact)
        expect(shareBankDetails.eligible(built)).toBe(verdict)
        // a fact this client reads defensively never drops the facts beside it
        expect(built.qr.hasMadeQrPayment).toBe(true)
        expect(built.hasReceivedRequestPayment).toBe(false)
    })

    test('no server answer leaves it unknown and the card keeps showing', () => {
        const built = applyServerFacts(state, undefined)
        expect(built.bankDepositReceived).toBeNull()
        expect(shareBankDetails.eligible(built)).toBe('show')
    })
})

test('CAT.4 response decoding retains only bounded explanation identifiers', () => {
    const server = asServerAttention(
        envelope({
            credential: 'secret-sentinel',
            email: 'private@example.invalid',
            explanations: {
                'balance-backup': { verdict: 'unknown', reason: 'facts-unavailable', unknownSources: ['balance'] },
                invite: { verdict: 'show', reason: 'private@example.invalid', unknownSources: [] },
            },
        })
    )
    expect(server?.explanations?.['balance-backup']).toEqual({
        verdict: 'unknown',
        reason: 'facts-unavailable',
        unknownSources: ['balance'],
    })
    expect(JSON.stringify(server)).not.toContain('secret-sentinel')
    expect(JSON.stringify(server)).not.toContain('private@example.invalid')
})

test('catalogue decoder rejects duplicated and excessive rows', () => {
    expect(asCatalogue(Array.from({ length: 65 }, () => DEFAULT_CATALOGUE[0]))).toBeUndefined()
    expect(asCatalogue([{ ...DEFAULT_CATALOGUE[0], policy: { interrupt: 'always', snoozeDays: -1 } }])).toBeUndefined()
})

test('a truncated catalogue cannot silently mix live and generated policy', () => {
    const server = asServerAttention(envelope({ catalogue: DEFAULT_CATALOGUE.filter((row) => row.id !== 'checklist') }))
    expect(server?.catalogue).toBeUndefined()
})

test('the previous catalogue preserves live rules and verdicts while update asks use bundled rules', () => {
    const catalogue = DEFAULT_CATALOGUE.filter((row) => !row.id.startsWith('app-update-')).map((row) =>
        row.id === 'balance-backup' ? { ...row, rank: 99 } : row
    )
    const server = asServerAttention(envelope({ catalogue, verdicts: { invite: 'show' } }))
    expect(server?.catalogue).toHaveLength(DEFAULT_CATALOGUE.length - 2)
    const asks = applyServerRanking(ASKS, server)
    expect(asks.find((ask) => ask.id === 'balance-backup')?.rank).toBe(99)
    expect(asks.find((ask) => ask.id === 'invite')?.eligible({} as JourneyState)).toBe('show')
    expect(asks.find((ask) => ask.id === 'app-update-important')).toMatchObject({ tier: 1, rank: 8 })
})

test.each(['app-update-important', 'app-update-regular'])('a catalogue missing only %s is rejected', (id) => {
    const server = asServerAttention(envelope({ catalogue: DEFAULT_CATALOGUE.filter((row) => row.id !== id) }))
    expect(server?.catalogue).toBeUndefined()
    expect(server?.verdicts).toEqual({})
})

test('partially unknown server onboarding keeps the known local checklist', () => {
    const state = {
        userId: 'user-a',
        userLoaded: true,
        blockedCardId: null,
        onboarding: {
            verify: 'todo',
            addMoneyDone: false,
            firstPaymentDone: false,
            firstPaymentRoute: 'pending',
            step: 'verify',
        },
    } as JourneyState
    const server = asServerAttention(envelope({ verdicts: { checklist: 'unknown' } }))
    expect(
        applyServerRanking(ASKS, server)
            .find((ask) => ask.id === 'checklist')
            ?.eligible(state)
    ).toBe('show')
})

test('a failed spend query with successful QR query does not become an old-spend recommendation', () => {
    const state = {
        now: Date.parse('2026-11-03T12:00:00Z'),
        userId: 'user-a',
        userLoaded: true,
        activated: true,
        balance: { loaded: true, usd: 20 },
        qr: { canPayNow: true, hasMadeQrPayment: true, verifyOpensQr: false },
        cardOffer: { canSpendViaCard: false },
        onboarding: null,
    } as JourneyState
    const server = asServerAttention(
        envelope({
            facts: {
                onboarding: null,
                firstPeerPaymentAt: null,
                lastSpendAt: null,
                spendHistoryAvailable: false,
                hasMadeQrPayment: true,
                hasReceivedRequestPayment: false,
            },
        })
    )
    const merged = applyServerFacts(state, server)
    expect(ASKS.find((ask) => ask.id === 'next-payment')?.eligible(merged)).toBe('unknown')
})

// TASK-25063: the Home push ask asks once more after the first bank or crypto deposit.
describe('the first deposit fact and the Home push re-ask', () => {
    const facts = {
        onboarding: null,
        firstPeerPaymentAt: null,
        lastSpendAt: null,
        spendHistoryAvailable: true,
        hasMadeQrPayment: true,
        hasReceivedRequestPayment: false,
    }
    const state = {
        userId: 'user-a',
        userLoaded: true,
        isNative: false,
        push: { ready: true, unanswered: true, promptedThisSession: false, notEnabled: true },
        now: Date.parse('2026-11-17T12:00:00Z'),
    } as unknown as JourneyState
    const pushAsk = ASKS.find((ask) => ask.id === 'push-home-fallback')!
    const snoozedFor = (version: string) => ({
        snoozedUntil: '2026-11-30T00:00:00Z',
        version,
    })

    test.each([
        ['true', { firstDepositReceived: true }, true],
        ['false', { firstDepositReceived: false }, false],
        ['null', { firstDepositReceived: null }, null],
        ['missing (an older API)', {}, null],
        ['not a boolean', { firstDepositReceived: 'yes' }, null],
    ])('%s reads as %p', (_label, patch, fact) => {
        const built = applyServerFacts(state, asServerAttention(envelope({ facts: { ...facts, ...patch } })))
        expect(built.firstDepositReceived).toBe(fact)
        expect(built.qr?.hasMadeQrPayment).toBe(true)
    })

    test('a snoozed Home ask re-arms once when the first deposit lands, then its new snooze holds', () => {
        const before = { ...state, firstDepositReceived: false }
        const after = { ...state, firstDepositReceived: true }
        expect(isSilenced(pushAsk, snoozedFor(pushAsk.version!(before)!), before)).toBe(true)
        // the deposit changes the version, so the old snooze no longer holds
        expect(isSilenced(pushAsk, snoozedFor(pushAsk.version!(before)!), after)).toBe(false)
        // answered "Not now" after the deposit: silenced like any snooze, no further re-arm
        expect(isSilenced(pushAsk, snoozedFor(pushAsk.version!(after)!), after)).toBe(true)
        expect(pushAsk.eligible(after)).toBe('show')
    })

    test.each([
        [true, 'first_deposit'],
        [false, 'home_fallback'],
        [null, 'home_fallback'],
        [undefined, 'home_fallback'],
    ])('firstDepositReceived %p asks with the %s trigger', (fact, trigger) => {
        expect(homePushTrigger({ firstDepositReceived: fact })).toBe(trigger)
        expect(pushAsk.legacyProps?.({ ...state, firstDepositReceived: fact }, 'shown')).toMatchObject({ trigger })
    })
})
