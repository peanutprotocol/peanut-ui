import { DEFAULT_CATALOGUE, DEFAULT_SETTINGS, asCatalogue } from '../catalogue'
import { ASKS } from '../registry'
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
    const server = asServerAttention(envelope({ ranking: [{ id: 'balance-backup', tier: 6, rank: 88 }], ...patch }))
    expect(server?.catalogue).toBeUndefined()
    expect(applyServerRanking(ASKS, server).find((entry) => entry.id === 'balance-backup')).toMatchObject({
        tier: 1,
        rank: 3,
        policy: { expiryDays: 21 },
    })
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
