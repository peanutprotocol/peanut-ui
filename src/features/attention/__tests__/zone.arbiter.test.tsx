/**
 * Phase 3 orchestration contract: the Home zone renders one card, chosen by
 * the manager, with rotation.
 *
 * The real cards are stubbed (`../zoneSurfaces`) so these tests pin the
 * manager's zone lifecycle, not any one card's UI. Every "handle" item of the
 * phase-3 failure list that lives in the orchestration has a test here.
 */
import React, { StrictMode, useLayoutEffect } from 'react'
import { act, render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { AskId, JourneyState, LedgerEntry } from '../types'

const mockCapture = jest.fn()
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

jest.mock('../surfaces', () => ({ INTERRUPT_SURFACES: {} }))

/** ZoneSurfaceProps (spec §1), kept local so the stubs do not depend on the export name */
interface StubProps {
    askId: AskId
    mode?: 'ask' | 'status'
    onActed: () => void
    onDismissed: () => void
    onSnoozed: (until?: number) => void
}

let mockZoneSurfaces: Partial<Record<string, React.ComponentType<StubProps>>> = {}
const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })
jest.mock('../surfaces/zone/TodoSummary', () => ({
    __esModule: true,
    default: () => <div data-testid="todo-summary" />,
}))
jest.mock('../zoneSurfaces', () => ({
    get ZONE_SURFACES() {
        return mockZoneSurfaces
    },
}))

import {
    AttentionProvider,
    resetAttentionSessionForTests,
    useAttention,
    useAttentionOptional,
} from '../AttentionProvider'
import { setSessionInterrupts } from '../interruptState'
import { ledgerActions, readLedger } from '../ledger'
import { updateUserPreferences } from '@/utils/general.utils'

const zoneModule = require('../AttentionZone')
const AttentionZone: React.ComponentType = zoneModule.AttentionZone ?? zoneModule.default

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.now()

const ZONE_ASKS = [
    'verification-due',
    'blocked-card',
    'checklist',
    'install-app',
    'verification-advisory',
    'qr-payment',
    'verify-for-qr',
    'card-offer',
    'push-home-fallback',
    'invite',
    'bug-bounty',
    'user-interview',
    // phase 4
    'virtual-account',
    'next-payment',
    'share-bank-details',
    'request-money',
    'send-money',
    'backup-passkey',
    'add-email',
    'rewards',
    'complete-profile',
]

const mockLife = { mounts: {} as Record<string, number>, unmounts: {} as Record<string, number> }

function stubFor(id: string): React.ComponentType<StubProps> {
    function StubZoneSurface({ askId, mode, onActed, onDismissed, onSnoozed }: StubProps) {
        useLayoutEffect(() => {
            mockLife.mounts[id] = (mockLife.mounts[id] ?? 0) + 1
            return () => {
                mockLife.unmounts[id] = (mockLife.unmounts[id] ?? 0) + 1
            }
        }, [])
        return (
            <div data-testid={`zone-${askId}`} data-mode={mode}>
                <button onClick={() => onActed()}>{`acted-${askId}`}</button>
                <button onClick={() => onDismissed()}>{`dismiss-${askId}`}</button>
                {/* "The install-app card's X snoozes 7 days (it passes until explicitly)" */}
                <button onClick={() => onSnoozed(Date.now() + 7 * DAY_MS)}>{`snooze-${askId}`}</button>
            </div>
        )
    }
    return StubZoneSurface
}

const allStubs = () => Object.fromEntries(ZONE_ASKS.map((id) => [id, stubFor(id)])) as typeof mockZoneSurfaces

const onboarding = (step: 'verify' | 'first_payment' | 'completed') => ({
    verify: step === 'verify' ? 'todo' : 'done',
    addMoneyDone: step !== 'verify',
    firstPaymentDone: step === 'completed',
    firstPaymentRoute: 'card_qr',
    step,
})

/** An activated user with nothing to show: each test turns its cards on. */
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
        onboarding: onboarding('completed'),
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
        ...overrides,
    }) as unknown as JourneyState

const BEFORE_ACTIVATION = { activated: false, onboarding: onboarding('verify') }
const INVITE_ONLY = { invitesSent: 0 }
const INVITE_AND_BUG_BOUNTY = { invitesSent: 0, hasSupportSurvivorBadge: false }
const INSTALL_APP_WEB = { isNative: false, migration: { on: true } }

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
            <AttentionZone />
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

/** a fresh app load for the same user: the next session count, a fresh session record */
function newSession(count: number, userId = 'user-a') {
    updateUserPreferences(userId, { sessionCount: count })
    resetAttentionSessionForTests()
}

const zonesInDom = () =>
    Array.from(document.querySelectorAll('[data-testid^="zone-"]')).map((el) =>
        el.getAttribute('data-testid')!.replace('zone-', '')
    )

const events = (name: string) => mockCapture.mock.calls.filter(([event]) => event === name).map(([, p]) => p)

const entry = (userId: string, askId: string): LedgerEntry | undefined =>
    (readLedger(userId) as Record<string, LedgerEntry | undefined>)[askId]

/** the install-app interrupt is refused by budget (a T1 already fired), so the zone may take it */
const t1AlreadyFired = () => setSessionInterrupts({ userId: 'user-a', ids: ['legal-reconsent'], open: null })
// install-app is tier 1 (the most critical ask): only a user-opened overlay keeps it out of the interrupt
const installCanOnlyTakeTheCard = () => {
    mockOverlayOpen = true
}

beforeEach(() => {
    mockOverlayOpen = false
    window.localStorage.clear()
    mockCapture.mockClear()
    mockCaptureException.mockClear()
    mockCaptureMessage.mockClear()
    resetAttentionSessionForTests()
    mockZoneSurfaces = allStubs()
    mockLife.mounts = {}
    mockLife.unmounts = {}
    mockState = state()
    latest = undefined
    updateUserPreferences('user-a', { sessionCount: 3 })
})

afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
})

describe('the Home zone', () => {
    test('the checklist holds the zone before activation; after activation one card shows alone', async () => {
        // "Before activation the zone is the checklist (T2)"; user-interview is eligible but lower
        mockState = state({ ...BEFORE_ACTIVATION, ...INVITE_AND_BUG_BOUNTY, flags: { userInterview: true } })
        const view = await mount()
        expect(zonesInDom()).toEqual(['checklist'])
        // "Renders at most one surface: the component for decision.zone.id"
        expect(screen.getByTestId('zone-checklist')).toHaveAttribute('data-mode', 'ask')

        // "After activation the zone shows one card, chosen by the manager"
        mockState = state(INVITE_ONLY)
        await rerender(view)
        expect(zonesInDom()).toEqual(['invite'])
        expect(screen.getByText('app-shell')).toBeInTheDocument()
    })

    test.each([{ strict: false }, { strict: true }])(
        'zone shown is booked once per session (StrictMode: $strict)',
        async ({ strict }) => {
            mockState = state(INVITE_ONLY)
            const view = await mount(strict)
            await rerender(view, strict)
            // "leaving Home and coming back in the same session books nothing new"
            view.unmount()
            await mount(strict)
            expect(zonesInDom()).toEqual(['invite'])

            // "analytics attention_shown { ask, surface: 'zone', tier }. Once per session per ask"
            const shown = events('attention_shown')
            expect(shown).toHaveLength(1)
            expect(shown[0]).toMatchObject({ ask: 'invite', surface: 'zone', tier: 5 })
            // "No legacy modal_* events for zone cards"
            expect(events('modal_shown')).toHaveLength(0)
            // "ledger shown for X with surface zone (this is what rotation counts: lastSessionShown, consecutiveSessions)"
            expect(entry('user-a', 'invite')?.lastSessionShown).toBe(3)
            expect(entry('user-a', 'invite')?.consecutiveSessions).toBe(1)
        }
    )

    test('consecutive sessions count up; a gap session resets the run', async () => {
        mockState = state(INVITE_ONLY)
        ;(await mount()).unmount()
        expect(entry('user-a', 'invite')?.consecutiveSessions).toBe(1)

        newSession(4)
        ;(await mount()).unmount()
        // "rotation counts: lastSessionShown, consecutiveSessions"
        expect(entry('user-a', 'invite')).toMatchObject({ lastSessionShown: 4, consecutiveSessions: 2 })
        expect(events('attention_shown')).toHaveLength(2)

        newSession(6)
        await mount()
        expect(entry('user-a', 'invite')).toMatchObject({ lastSessionShown: 6, consecutiveSessions: 1 })
    })

    test('the X dismisses, the next card shows at once, and a double click writes once', async () => {
        const dismissSpy = jest.spyOn(ledgerActions, 'dismissed')
        mockState = state(INVITE_AND_BUG_BOUNTY)
        await mount()
        expect(zonesInDom()).toEqual(['invite'])
        const x = screen.getByText('dismiss-invite')

        // failure #3: "double X on a card → settle ignored unless it is the zone ask"
        await act(async () => {
            x.click()
            x.click()
        })

        // "onDismissed (the card's X) → ledger dismissedAt + version"
        expect(dismissSpy).toHaveBeenCalledTimes(1)
        const invite = entry('user-a', 'invite')
        expect(invite?.dismissedAt).toBeDefined()
        expect(invite?.version).toBe(latest?.asks.find((ask) => (ask.id as string) === 'invite')?.version?.(mockState))
        // "analytics attention_dismissed { surface: 'zone' }"
        const dismissed = events('attention_dismissed')
        expect(dismissed).toHaveLength(1)
        expect(dismissed[0]).toMatchObject({ ask: 'invite', surface: 'zone' })
        expect(events('modal_dismissed')).toHaveLength(0)
        // "the zone re-decides and shows the next candidate immediately"
        expect(zonesInDom()).toEqual(['bug-bounty'])
    })

    test('the install-app card snoozes', async () => {
        installCanOnlyTakeTheCard()
        mockState = state(INSTALL_APP_WEB)
        await mount()
        expect(latest?.decision.interrupt).toBeNull()
        expect(zonesInDom()).toEqual(['install-app'])
        const clickedAt = Date.now()

        await click('snooze-install-app')

        // "onSnoozed(until?) → ledger snoozedUntil, attention_snoozed"
        const until = Date.parse(entry('user-a', 'install-app')?.snoozedUntil ?? '')
        expect(until).toBeGreaterThanOrEqual(clickedAt + 7 * DAY_MS - 60_000)
        expect(until).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS + 60_000)
        const snoozed = events('attention_snoozed')
        expect(snoozed).toHaveLength(1)
        expect(snoozed[0]).toMatchObject({ ask: 'install-app', surface: 'zone' })
        expect(zonesInDom()).toEqual([])
    })

    test('a settle for an ask that is not in the zone writes nothing', async () => {
        mockState = state(INVITE_AND_BUG_BOUNTY)
        await mount()
        expect(zonesInDom()).toEqual(['invite'])

        // "A settle for an ask that is not the one in the zone is ignored."
        await act(async () => {
            latest!.dismissed('bug-bounty' as AskId)
        })
        expect(entry('user-a', 'bug-bounty')?.dismissedAt).toBeUndefined()
        expect(events('attention_dismissed')).toHaveLength(0)
        expect(zonesInDom()).toEqual(['invite'])
    })

    test('no flash of a lower card before the checklist loads', async () => {
        // "an invite card never appears for a frame before the checklist decides it is still needed"
        mockState = state({ ...INVITE_ONLY, onboarding: null })
        const view = await mount()
        expect(zonesInDom()).toEqual([])
        expect(events('attention_shown')).toHaveLength(0)

        mockState = state({ ...INVITE_ONLY, ...BEFORE_ACTIVATION })
        await rerender(view)
        expect(zonesInDom()).toEqual(['checklist'])
        expect(mockLife.mounts.invite ?? 0).toBe(0)
    })

    test('the checklist never loads: the hold releases at the settle deadline', async () => {
        // "holds the zone ... while any ask with a zone surface in a higher tier ... is still unknown, until the 4 s settle deadline"
        jest.useFakeTimers()
        mockState = state({ ...INVITE_ONLY, onboarding: null })
        await mount()
        expect(zonesInDom()).toEqual([])

        await act(async () => {
            jest.advanceTimersByTime(4_000)
        })
        expect(zonesInDom()).toEqual(['invite'])
    })

    test('rotation: a resting card yields one session; never an empty zone; T1/T2 never rotate', async () => {
        const resting = { lastSessionShown: 2, consecutiveSessions: 3 }

        // "a T3+ card that held the zone for 3 sessions in a row yields for one session"
        updateUserPreferences('user-a', { attention: { invite: resting } })
        mockState = state(INVITE_AND_BUG_BOUNTY)
        let view = await mount()
        expect(zonesInDom()).toEqual(['bug-bounty'])
        view.unmount()

        // "if every candidate is resting, the top one shows anyway"
        window.localStorage.clear()
        newSession(3)
        updateUserPreferences('user-a', { attention: { invite: resting, 'bug-bounty': resting } })
        view = await mount()
        expect(zonesInDom()).toEqual(['invite'])
        view.unmount()

        // "T1 and T2 never rotate" (a fresh T5 card is eligible below it)
        window.localStorage.clear()
        newSession(3)
        updateUserPreferences('user-a', { attention: { checklist: resting } })
        mockState = state({ ...BEFORE_ACTIVATION, flags: { userInterview: true } })
        await mount()
        expect(zonesInDom()).toEqual(['checklist'])
    })

    test('interrupt and zone never show the same ask', async () => {
        // install-app is eligible for both (web, migration on); after activation no to-do list holds Home
        mockState = state({ ...INSTALL_APP_WEB, ...INVITE_ONLY })
        await mount()
        expect(latest?.decision.interrupt).toBe('install-app')
        expect(latest?.decision.zone?.id).toBe('invite')
        expect(zonesInDom()).toEqual(['invite'])
    })

    test('a throwing zone surface is contained, settled as dismissed, and the next card renders', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {})
        const boom = new Error('zone card exploded')
        mockZoneSurfaces = {
            ...allStubs(),
            invite: () => {
                throw boom
            },
        }
        mockState = state(INVITE_AND_BUG_BOUNTY)
        await mount()

        // "a throwing surface is contained by a boundary, settled as dismissed, reported to Sentry tagged feature: attention"
        expect(mockCaptureException).toHaveBeenCalledWith(
            boom,
            expect.objectContaining({ tags: expect.objectContaining({ feature: 'attention' }) })
        )
        expect(entry('user-a', 'invite')?.dismissedAt).toBeDefined()
        // "and the next candidate renders"
        expect(zonesInDom()).toEqual(['bug-bounty'])
        expect(screen.getByText('app-shell')).toBeInTheDocument()
        expect(latest).toBeDefined()
    })

    test('registry drift: a decided ask with no zone surface renders nothing and reports once', async () => {
        const { invite: _missing, ...rest } = allStubs()
        mockZoneSurfaces = rest
        mockState = state(INVITE_AND_BUG_BOUNTY)
        const view = await mount()
        await rerender(view)
        await rerender(view)

        // "A decided id with no surface renders nothing and reports captureMessage once."
        expect(zonesInDom()).toEqual([])
        expect(screen.getByText('app-shell')).toBeInTheDocument()
        expect(mockCaptureMessage).toHaveBeenCalledTimes(1)
        expect(events('attention_shown')).toHaveLength(0)
    })

    test('an account switch unmounts the card and starts the new user fresh', async () => {
        updateUserPreferences('user-b', { sessionCount: 2 })
        mockState = state(INVITE_ONLY)
        const view = await mount()
        expect(zonesInDom()).toEqual(['invite'])

        // failure #7: "user-keyed surface, no stale state"; "Surfaces are keyed by ${userId}:${askId}"
        mockState = state({ ...INVITE_ONLY, userId: 'user-b' })
        await rerender(view)
        expect(mockLife.unmounts.invite).toBe(1)
        expect(mockLife.mounts.invite).toBe(2)
        expect(zonesInDom()).toEqual(['invite'])

        // the new user's own bookkeeping: a new attention_shown, its own ledger, a fresh session
        expect(events('attention_shown')).toHaveLength(2)
        expect(entry('user-b', 'invite')).toMatchObject({ lastSessionShown: 2, consecutiveSessions: 1 })
        expect(entry('user-a', 'invite')).toMatchObject({ lastSessionShown: 3, consecutiveSessions: 1 })
        expect(latest?.session.interruptsThisSession).toEqual([])
        expect(latest?.session.count).toBe(2)
    })

    test.each([
        {
            label: 'invite-friends (object shape)',
            stored: { 'invite-friends': new Date(NOW - DAY_MS).toISOString() },
            patch: INVITE_ONLY,
            ask: 'invite',
            hidden: true,
        },
        {
            label: 'latam-cashback-invite',
            stored: { 'latam-cashback-invite': new Date(NOW - DAY_MS).toISOString() },
            patch: { ...INVITE_ONLY, geoCountry: 'AR' },
            ask: 'invite',
            hidden: true,
        },
        {
            label: 'bug-bounty (legacy array shape)',
            stored: ['bug-bounty'],
            patch: { hasSupportSurvivorBadge: false },
            ask: 'bug-bounty',
            hidden: true,
        },
        {
            label: 'user-interview',
            stored: { 'user-interview': new Date(NOW - 30 * DAY_MS).toISOString() },
            patch: { flags: { userInterview: true } },
            ask: 'user-interview',
            hidden: true,
        },
        {
            label: 'app-install closed 8 days ago (recurring, re-armed)',
            stored: { 'app-install': new Date(NOW - 8 * DAY_MS).toISOString() },
            patch: INSTALL_APP_WEB,
            ask: 'install-app',
            hidden: false,
        },
        {
            label: 'app-install closed yesterday (7-day snooze holds)',
            stored: { 'app-install': new Date(NOW - DAY_MS).toISOString() },
            patch: INSTALL_APP_WEB,
            ask: 'install-app',
            hidden: true,
        },
    ])('legacy carousel close is honoured: $label', async ({ stored, patch, ask, hidden }) => {
        // "Ledger legacy mapping: dismissedCarouselCTAs entries map slide id → ask id (... app-install → install-app
        //  with a 7-day snooze from the close date ...), including the legacy string[] shape (closed 'now')"
        t1AlreadyFired()
        if (ask === 'install-app') installCanOnlyTakeTheCard()
        updateUserPreferences('user-a', { dismissedCarouselCTAs: stored as Record<string, string> | string[] })
        mockState = state(patch)
        await mount()
        if (hidden) expect(zonesInDom()).not.toContain(ask)
        else expect(zonesInDom()).toEqual([ask])
    })
})

describe('parity over the real modules', () => {
    test('every ask with a zone surface has a component in the real ZONE_SURFACES', () => {
        // "ZONE_SURFACES must have an entry for every ask whose surfaces include 'zone' (parity test)"; failure #1
        const { ZONE_SURFACES } = jest.requireActual('../zoneSurfaces') as {
            ZONE_SURFACES: Partial<Record<string, unknown>>
        }
        const { ASKS } = jest.requireActual('../registry') as {
            ASKS: readonly { id: string; surfaces: string[] }[]
        }
        const zoneAsks = ASKS.filter((ask) => ask.surfaces.includes('zone')).map((ask) => ask.id)
        expect([...zoneAsks].sort()).toEqual([...ZONE_ASKS].sort())
        expect(zoneAsks.filter((id) => !ZONE_SURFACES[id])).toEqual([])
    })
})
