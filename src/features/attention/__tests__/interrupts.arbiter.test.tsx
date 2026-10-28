/**
 * Phase 2 orchestration contract: interrupts render through the manager.
 *
 * The real modals are stubbed (`../surfaces`) so these tests pin the manager's
 * lifecycle, not any one prompt's UI. Every "handle" item of the phase-2
 * failure list that lives in the orchestration has at least one test here.
 */
import React, { StrictMode, useLayoutEffect } from 'react'
import { act, render, screen } from '@testing-library/react'
import type { AskId, AskSurfaceProps, JourneyState } from '../types'

const mockCapture = jest.fn()
jest.mock('../serverAttention', () => ({
    ...jest.requireActual('../serverAttention'),
    useServerAttention: () => undefined,
}))
jest.mock('posthog-js', () => ({ capture: (...args: unknown[]) => mockCapture(...args) }))

const mockCaptureException = jest.fn()
const mockCaptureMessage = jest.fn()
jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
    captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}))

let mockOverlayOpen = false
jest.mock('@/utils/overlay-visibility', () => ({
    ...jest.requireActual('@/utils/overlay-visibility'),
    useAnyOverlayOpen: () => mockOverlayOpen,
}))

let mockState: JourneyState
jest.mock('../journeyState', () => ({
    ...jest.requireActual('../journeyState'),
    useJourneyState: () => mockState,
}))

let mockSurfaces: Partial<Record<AskId, React.ComponentType<AskSurfaceProps>>> = {}
jest.mock('../surfaces', () => ({
    get INTERRUPT_SURFACES() {
        return mockSurfaces
    },
}))

import {
    AttentionProvider,
    resetAttentionSessionForTests,
    useAttention,
    useAttentionOptional,
} from '../AttentionProvider'
import { ledgerActions, readLedger } from '../ledger'
import { ASKS, legalReconsent } from '../registry'
import { updateUserPreferences } from '@/utils/general.utils'

const interruptModule = require('../AttentionInterrupt')
const AttentionInterrupt: React.ComponentType = interruptModule.AttentionInterrupt ?? interruptModule.default

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-10-11T12:00:00Z')

const INTERRUPT_ASKS: AskId[] = [
    'legal-reconsent',
    'balance-backup',
    'post-verification-action',
    'finish-card-setup',
    'install-app',
    'push-home-fallback',
    'early-user',
]

// mount bookkeeping of the stub surfaces, in layout effects so a commit that
// unmounts A and mounts B is seen in its real order
const mockLife = {
    live: new Set<string>(),
    maxLive: 0,
    mounts: {} as Record<string, number>,
    unmounts: {} as Record<string, number>,
}

function stubFor(id: AskId): React.ComponentType<AskSurfaceProps> {
    function StubSurface({ askId, onActed, onDismissed, onSnoozed }: AskSurfaceProps) {
        useLayoutEffect(() => {
            mockLife.live.add(id)
            mockLife.maxLive = Math.max(mockLife.maxLive, mockLife.live.size)
            mockLife.mounts[id] = (mockLife.mounts[id] ?? 0) + 1
            return () => {
                mockLife.live.delete(id)
                mockLife.unmounts[id] = (mockLife.unmounts[id] ?? 0) + 1
            }
        }, [])
        return (
            <div data-testid={`surface-${askId}`}>
                <button onClick={() => onActed()}>{`acted-${askId}`}</button>
                <button onClick={() => onDismissed()}>{`dismiss-${askId}`}</button>
                <button onClick={() => onSnoozed()}>{`snooze-${askId}`}</button>
            </div>
        )
    }
    return StubSurface
}

const allStubs = () => Object.fromEntries(INTERRUPT_ASKS.map((id) => [id, stubFor(id)])) as typeof mockSurfaces

/** Everything quiet: no ask wants a surface unless a test turns it on. */
const state = (overrides: Record<string, unknown> = {}): JourneyState =>
    ({
        capNudge: null,
        maintenance: 'none',
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
        activated: false,
        geoCountry: null,
        invitesSent: 0,
        hasSupportSurvivorBadge: false,
        cardOffer: { loaded: true, geoProhibited: false, hasCardRelationship: false, promotionDisabled: false },
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
        ...overrides,
    }) as unknown as JourneyState

const TERMS_NEEDED = {
    status: 'needed',
    versions: ['2026-10-01'],
    documents: [{ slug: 'terms', currentVersion: '2026-10-01' }],
}

let latest: ReturnType<typeof useAttention> | undefined
function Probe() {
    latest = useAttentionOptional()
    return null
}

const Tree = ({ strict = false }: { strict?: boolean }) => {
    const tree = (
        <AttentionProvider>
            <div>app-shell</div>
            <Probe />
            <AttentionInterrupt />
        </AttentionProvider>
    )
    return strict ? <StrictMode>{tree}</StrictMode> : tree
}

const flush = () => act(async () => {})

async function mount(strict = false) {
    const view = render(<Tree strict={strict} />)
    await flush()
    return view
}

async function rerender(view: ReturnType<typeof render>, strict = false) {
    view.rerender(<Tree strict={strict} />)
    await flush()
}

async function click(text: string) {
    await act(async () => {
        screen.getByText(text).click()
    })
}

const surfacesInDom = () =>
    Array.from(document.querySelectorAll('[data-testid^="surface-"]')).map((el) =>
        el.getAttribute('data-testid')!.replace('surface-', '')
    )

const events = (name: string) => mockCapture.mock.calls.filter(([event]) => event === name).map(([, p]) => p)

beforeEach(() => {
    window.localStorage.clear()
    mockCapture.mockClear()
    mockCaptureException.mockClear()
    mockCaptureMessage.mockClear()
    resetAttentionSessionForTests()
    mockOverlayOpen = false
    mockSurfaces = allStubs()
    mockLife.live.clear()
    mockLife.maxLive = 0
    mockLife.mounts = {}
    mockLife.unmounts = {}
    mockState = state()
    latest = undefined
    updateUserPreferences('user-a', { sessionCount: 3 })
})

afterEach(() => {
    jest.restoreAllMocks()
})

test('the 7 Oct incident: terms and the announcement never stack, and the announcement waits for a quiet session', async () => {
    mockState = state({ consent: TERMS_NEEDED, showEarlyUserModal: true })
    const first = await mount()
    // "Renders at most one surface": terms (T1) wins over early-user (T6)
    expect(surfacesInDom()).toEqual(['legal-reconsent'])

    await click('snooze-legal-reconsent')
    // "T6 ... only when ... no interrupt this session": the announcement may not follow a T1
    expect(surfacesInDom()).toEqual([])
    mockState = state({ consent: TERMS_NEEDED, showEarlyUserModal: true, now: NOW + 60_000 })
    await rerender(first)
    expect(surfacesInDom()).toEqual([])
    first.unmount()

    // a later, quiet session: the terms snooze holds, nothing in T1–T5 → the announcement may open
    resetAttentionSessionForTests()
    updateUserPreferences('user-a', { sessionCount: 4 })
    mockState = state({ consent: TERMS_NEEDED, showEarlyUserModal: true, now: NOW + DAY_MS })
    await mount()
    expect(surfacesInDom()).toEqual(['early-user'])
})

test('one surface at a time: T1 after T1 is allowed, T4 after a T1 is not', async () => {
    mockState = state({
        consent: TERMS_NEEDED,
        balance: { loaded: true, usd: 900 },
        push: { ready: true, unanswered: true, promptedThisSession: false, notEnabled: false },
        showEarlyUserModal: true,
    })
    const view = await mount()
    expect(surfacesInDom()).toEqual(['legal-reconsent'])

    await click('acted-legal-reconsent')
    // "T1 after T1 is allowed ... its surface mounts immediately"
    expect(surfacesInDom()).toEqual(['balance-backup'])

    await click('dismiss-balance-backup')
    // "T3/T4/T6 are not [allowed] after a T1"
    expect(surfacesInDom()).toEqual([])
    await rerender(view)
    expect(surfacesInDom()).toEqual([])

    // "the previous surface is unmounted without an exit animation": never two at once, even within one commit
    expect(mockLife.maxLive).toBe(1)
})

test('shown bookkeeping is idempotent under StrictMode', async () => {
    mockState = state({ consent: TERMS_NEEDED })
    await mount(true)
    expect(surfacesInDom()).toEqual(['legal-reconsent'])

    // "attention_shown ... AND the legacy modal_shown ... each exactly once per show, even under React StrictMode"
    const shown = events('attention_shown')
    expect(shown).toHaveLength(1)
    expect(shown[0]).toMatchObject({ ask: 'legal-reconsent', surface: 'interrupt', tier: 1 })
    const legacy = events('modal_shown')
    expect(legacy).toHaveLength(1)
    expect(legacy[0]).toMatchObject({ modal_type: legalReconsent.analyticsKey })

    // "ledger shown for X (surface interrupt)" once
    expect(readLedger('user-a')['legal-reconsent']?.shownAt).toHaveLength(1)
    // "X appended to session.interruptsThisSession once"; "session.openInterrupt = X"
    expect(latest?.session.interruptsThisSession).toEqual(['legal-reconsent'])
    expect(latest?.session.openInterrupt).toBe('legal-reconsent')
})

test('a double settle is ignored: one write, one report', async () => {
    const snoozeSpy = jest.spyOn(ledgerActions, 'snoozed')
    mockState = state({ consent: TERMS_NEEDED })
    await mount()
    const notNow = screen.getByText('snooze-legal-reconsent')

    // "A handler for an ask that is not the open one is ignored (a double tap on 'Not now' writes once, reports once)"
    await act(async () => {
        notNow.click()
        notNow.click()
    })

    expect(snoozeSpy).toHaveBeenCalledTimes(1)
    expect(readLedger('user-a')['legal-reconsent']?.snoozedUntil).toBeDefined()
    expect(events('attention_snoozed')).toHaveLength(1)
    expect(events('modal_dismissed')).toHaveLength(1)
    expect(surfacesInDom()).toEqual([])
})

test.each([
    {
        handler: 'acted',
        button: 'acted-legal-reconsent',
        field: 'dismissedAt' as const,
        event: 'attention_acted',
        legacyEvent: 'modal_cta_clicked',
    },
    {
        handler: 'dismissed',
        button: 'dismiss-legal-reconsent',
        field: 'dismissedAt' as const,
        event: 'attention_dismissed',
        legacyEvent: 'modal_dismissed',
    },
    {
        handler: 'snoozed',
        button: 'snooze-legal-reconsent',
        field: 'snoozedUntil' as const,
        event: 'attention_snoozed',
        legacyEvent: 'modal_dismissed',
    },
])(
    '$handler writes $field with the version and reports $event + $legacyEvent',
    async ({ button, field, event, legacyEvent }) => {
        mockState = state({ consent: TERMS_NEEDED })
        await mount()
        const clickedAt = Date.now()
        await click(button)

        const entry = readLedger('user-a')['legal-reconsent']
        // "onActed → ledger dismissedAt + version"; "onDismissed → ledger dismissedAt + version"; "onSnoozed → ledger snoozedUntil + version"
        expect(entry?.[field]).toBeDefined()
        expect(entry?.version).toBe(legalReconsent.version?.(mockState))
        if (field === 'snoozedUntil') {
            // "until defaults to now + policy.snoozeDays" (7 for terms); "now" may be the journey clock or the wall clock
            const until = Date.parse(entry!.snoozedUntil!)
            const week = legalReconsent.policy.snoozeDays! * DAY_MS
            expect(until).toBeGreaterThanOrEqual(Math.min(NOW, clickedAt) + week - 60_000)
            expect(until).toBeLessThanOrEqual(Math.max(NOW, Date.now()) + week + 60_000)
        }

        // "attention_acted + legacy modal_cta_clicked", "attention_dismissed + legacy modal_dismissed", "attention_snoozed + legacy modal_dismissed"
        const reports = events(event)
        expect(reports).toHaveLength(1)
        expect(reports[0]).toMatchObject({ ask: 'legal-reconsent' })
        const legacy = events(legacyEvent)
        expect(legacy).toHaveLength(1)
        expect(legacy[0]).toMatchObject({ modal_type: legalReconsent.analyticsKey })

        // "openInterrupt = null"; the local mark stops an immediate re-pick while the server catches up
        expect(latest?.session.openInterrupt).toBeNull()
        expect(surfacesInDom()).toEqual([])
    }
)

test('an open surface is sticky across navigation and leaves when its verdict stops being show', async () => {
    mockState = state({ balance: { loaded: true, usd: 900 } })
    const view = await mount()
    expect(surfacesInDom()).toEqual(['balance-backup'])

    // "An open surface stays mounted while the user navigates (sticky), even to a route where it could not have opened"
    mockState = state({ balance: { loaded: true, usd: 900 }, route: 'other' })
    await rerender(view)
    expect(surfacesInDom()).toEqual(['balance-backup'])
    expect(mockLife.mounts['balance-backup']).toBe(1)

    // "it unmounts ... when its verdict stops being show"
    mockState = state({ balance: { loaded: true, usd: 0 }, route: 'other' })
    await rerender(view)
    expect(surfacesInDom()).toEqual([])
})

test('an account switch or logout while a surface is open unmounts it and starts the new user fresh', async () => {
    mockState = state({ balance: { loaded: true, usd: 900 } })
    const view = await mount()
    expect(surfacesInDom()).toEqual(['balance-backup'])

    // logout: "logout / account switch resets openInterrupt"
    mockState = state({ userId: null, balance: { loaded: true, usd: 900 } })
    await rerender(view)
    expect(surfacesInDom()).toEqual([])
    expect(latest?.session.openInterrupt).toBeNull()
    expect(latest?.session.interruptsThisSession).toEqual([])

    // switching user mid-load: nothing of user-a's session carries over
    mockState = state({ userId: 'user-b', userLoaded: false, balance: { loaded: true, usd: 900 } })
    await rerender(view)
    expect(surfacesInDom()).toEqual([])
    expect(latest?.session.interruptsThisSession).toEqual([])

    // user-b loaded and eligible: a fresh show of its own
    mockState = state({ userId: 'user-b', balance: { loaded: true, usd: 900 } })
    await rerender(view)
    expect(surfacesInDom()).toEqual(['balance-backup'])
    expect(mockLife.mounts['balance-backup']).toBe(2)
    expect(latest?.session.interruptsThisSession).toEqual(['balance-backup'])
    expect(readLedger('user-b')['balance-backup']?.shownAt).toHaveLength(1)

    // a direct switch: "the surface unmounts" — user-c gets its own instance and its own show
    mockState = state({ userId: 'user-c', balance: { loaded: true, usd: 900 } })
    await rerender(view)
    expect(mockLife.unmounts['balance-backup']).toBe(2)
    expect(mockLife.mounts['balance-backup']).toBe(3)
    expect(latest?.session.interruptsThisSession).toEqual(['balance-backup'])
    expect(readLedger('user-c')['balance-backup']?.shownAt).toHaveLength(1)
    expect(readLedger('user-b')['balance-backup']?.shownAt).toHaveLength(1)
})

test('a user-opened overlay blocks a new surface but never suspends the open one', async () => {
    // "a user-opened overlay (support drawer, QR scanner) does prevent a new interrupt from opening"
    mockOverlayOpen = true
    mockState = state({ consent: TERMS_NEEDED })
    const view = await mount()
    expect(surfacesInDom()).toEqual([])

    mockOverlayOpen = false
    await rerender(view)
    expect(surfacesInDom()).toEqual(['legal-reconsent'])

    // "session.busy ... no longer suspends the manager's own open interrupt"
    mockOverlayOpen = true
    await rerender(view)
    expect(surfacesInDom()).toEqual(['legal-reconsent'])
    expect(mockLife.mounts['legal-reconsent']).toBe(1)
    expect(mockLife.unmounts['legal-reconsent'] ?? 0).toBe(0)
})

test('a throwing surface is contained, settled as dismissed, reported, and not re-mounted', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const boom = new Error('surface exploded')
    let renders = 0
    mockSurfaces = {
        ...allStubs(),
        'legal-reconsent': () => {
            renders++
            throw boom
        },
    }
    mockState = state({ consent: TERMS_NEEDED })
    const view = await mount()

    // "the rest of the app keeps rendering" (and the manager itself survives)
    expect(screen.getByText('app-shell')).toBeInTheDocument()
    expect(latest).toBeDefined()
    // "Sentry gets the error tagged feature: attention"
    expect(mockCaptureException).toHaveBeenCalledWith(
        boom,
        expect.objectContaining({ tags: expect.objectContaining({ feature: 'attention' }) })
    )
    // "the ask is settled as dismissed (so it does not re-mount in a loop)"
    expect(readLedger('user-a')['legal-reconsent']?.dismissedAt).toBeDefined()
    expect(latest?.session.openInterrupt).toBeNull()

    const rendersAfterFailure = renders
    await rerender(view)
    await rerender(view)
    expect(renders).toBe(rendersAfterFailure)
    expect(surfacesInDom()).toEqual([])
})

test('registry drift: a decided ask with no surface renders nothing and reports once', async () => {
    const { 'legal-reconsent': _missing, ...rest } = allStubs()
    mockSurfaces = rest
    mockState = state({ consent: TERMS_NEEDED })
    const view = await mount()
    await rerender(view)
    await rerender(view)

    // "nothing renders and Sentry gets a message once"
    expect(surfacesInDom()).toEqual([])
    expect(screen.getByText('app-shell')).toBeInTheDocument()
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1)
    // shown bookkeeping happens "when a surface mounts"; none did
    expect(events('attention_shown')).toHaveLength(0)
})

test.each([
    { legacySnooze: true, expected: [] as string[] },
    { legacySnooze: false, expected: ['install-app'] },
])('legacy download-prompt snooze is honoured (legacy snooze: $legacySnooze)', async ({ legacySnooze, expected }) => {
    // failure list #12: "devices with legacy snoozes ... an orchestration test proves no re-ask"
    if (legacySnooze)
        updateUserPreferences('user-a', { migrationPromptSnoozedAt: new Date(NOW - DAY_MS).toISOString() })
    mockState = state({ isNative: false, migration: { on: true } })
    await mount()
    expect(surfacesInDom()).toEqual(expected)
})

test.each([
    { promptedThisSession: true, expected: [] as string[] },
    { promptedThisSession: false, expected: ['push-home-fallback'] },
])(
    'the Home push ask stands down after a store pre-prompt this session (prompted: $promptedThisSession)',
    async ({ promptedThisSession, expected }) => {
        // "the manager's push-home-fallback ask is ineligible for the rest of a session in which the store already showed a pre-prompt"
        mockState = state({ push: { ready: true, unanswered: true, promptedThisSession } })
        await mount()
        expect(surfacesInDom()).toEqual(expected)
    }
)

test('attention_decided still fires, now with shadow: false', async () => {
    mockState = state({ consent: TERMS_NEEDED })
    await mount()
    // "The attention_decided event keeps firing on every distinct decision, now with shadow: false"
    const decided = events('attention_decided')
    expect(decided.length).toBeGreaterThan(0)
    expect(decided[0]).toMatchObject({ shadow: false, interrupt: 'legal-reconsent' })
    expect(decided.some((payload) => payload.shadow === true)).toBe(false)
})

test('parity: every ask with an interrupt surface has a component in the real INTERRUPT_SURFACES', () => {
    // failure list #1: "registry drift ... handle: parity test"
    const { INTERRUPT_SURFACES } = jest.requireActual('../surfaces') as {
        INTERRUPT_SURFACES: Partial<Record<AskId, unknown>>
    }
    const { ASKS: realAsks } = jest.requireActual('../registry') as { ASKS: typeof ASKS }
    const interruptAsks = realAsks.filter((ask) => ask.surfaces.includes('interrupt')).map((ask) => ask.id)
    expect(interruptAsks.length).toBeGreaterThan(0)
    expect(interruptAsks.filter((id) => !INTERRUPT_SURFACES[id])).toEqual([])
})
