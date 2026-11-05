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
import type { AskId, JourneyState } from '../types'
import { asServerAttention, type ServerAttention } from '../serverAttention'

const mockCapture = jest.fn()
let mockServerAttention: ServerAttention | undefined
jest.mock('../serverAttention', () => ({
    ...jest.requireActual('../serverAttention'),
    useServerAttention: () => mockServerAttention,
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

jest.mock('../surfaces', () => ({ INTERRUPT_SURFACES: {} }))

/** ZoneSurfaceProps (spec §1), kept local so the stubs do not depend on the export name */
interface StubProps {
    askId: AskId
    mode: 'ask' | 'status'
    onActed: () => void
    onDismissed: () => void
    onSnoozed: (until?: number) => void
}

let mockZoneSurfaces: Partial<Record<string, React.ComponentType<StubProps>>> = {}
const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })
jest.mock('../surfaces/AttentionFlowHost', () => ({
    AttentionFlowHost: ({ children }: { children: React.ReactNode }) => children,
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

import { readLedger } from '../ledger'
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

/** the install-app interrupt is refused by budget (a T1 already fired), so the zone may take it */

// install-app is tier 1 (the most critical ask): only a user-opened overlay keeps it out of the interrupt

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
    mockServerAttention = undefined
    latest = undefined
    updateUserPreferences('user-a', { sessionCount: 3 })
})

afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
})

import ChecklistSurface from '../surfaces/zone/ChecklistSurface'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-a' } }, isFetchingUser: false }),
}))
jest.mock('@/hooks/useActivationStatus', () => ({ useActivationStatus: () => ({ onboarding: mockState.onboarding }) }))
jest.mock('@/features/home/useHomeWelcome', () => ({ useHomeWelcome: () => false }))
// ActivationCTAs draws the blocked card or the to-do list as the surface asks (its own suite covers both).
jest.mock('@/components/Home/ActivationCTAs', () => ({
    __esModule: true,
    default: ({ showBlockedCard, onHideBlockedCard }: { showBlockedCard?: boolean; onHideBlockedCard?: () => void }) =>
        showBlockedCard ? (
            <div>blocked reason{onHideBlockedCard && <button onClick={onHideBlockedCard}>Hide</button>}</div>
        ) : (
            <div>to-do list</div>
        ),
}))

const VERIFICATION_ISSUE = 'blocked-card:verification-issue:identity_failed'

/** the API ranks both anchors and judges the list on onboarding alone: it holds no blocked-card facts */
const serverRanking = () =>
    asServerAttention({
        version: 1,
        nextAsk: 'checklist',
        ranking: [
            { id: 'blocked-card', tier: 2, rank: 2 },
            { id: 'checklist', tier: 2, rank: 3 },
        ],
        verdicts: { checklist: 'show' },
    })

test.each([
    ['the local ranking', () => undefined],
    ['the server ranking', serverRanking],
])('hiding a blocked card shows the to-do list under %s, never the same card again', async (_, server) => {
    mockServerAttention = server()
    mockState = state({ ...BEFORE_ACTIVATION, blockedCardId: VERIFICATION_ISSUE })
    mockZoneSurfaces = { ...allStubs(), 'blocked-card': ChecklistSurface, checklist: ChecklistSurface }
    const view = await mount()
    expect(latest?.decision.zone?.id).toBe('blocked-card')
    expect(screen.getByText('blocked reason')).toBeInTheDocument()

    await click('Hide')
    expect(latest?.decision.zone?.id).toBe('checklist')
    expect(screen.getByText('to-do list')).toBeInTheDocument()
    expect(screen.queryByText('blocked reason')).not.toBeInTheDocument()
    expect(screen.queryByText('Hide')).not.toBeInTheDocument()
    expect(readLedger('user-a')['blocked-card']?.version).toBe(VERIFICATION_ISSUE)
    // the list itself was never dismissed: it stays once the door opens
    expect(readLedger('user-a').checklist?.dismissedAt).toBeUndefined()

    // the hidden card stays hidden across a reload of the same facts
    await rerender(view)
    expect(latest?.decision.zone?.id).toBe('checklist')
    expect(screen.getByText('to-do list')).toBeInTheDocument()
})

test('a hidden blocked card comes back over the list when its reason changes', async () => {
    mockServerAttention = serverRanking()
    mockState = state({ ...BEFORE_ACTIVATION, blockedCardId: VERIFICATION_ISSUE })
    mockZoneSurfaces = { ...allStubs(), 'blocked-card': ChecklistSurface, checklist: ChecklistSurface }
    const view = await mount()
    await click('Hide')
    expect(screen.getByText('to-do list')).toBeInTheDocument()
    mockState = state({ ...BEFORE_ACTIVATION, blockedCardId: 'blocked-card:verification-issue:duplicate_account' })
    await rerender(view)
    expect(latest?.decision.zone?.id).toBe('blocked-card')
    expect(screen.getByText('blocked reason')).toBeInTheDocument()
})

test.each(['dismiss', 'snooze'] as const)(
    'an identity restart leads bank documents until the user %ss it',
    async (action) => {
        mockState = state({
            ...BEFORE_ACTIVATION,
            blockedCardId: 'blocked-card:restart-identity:provider_rejected',
            blockedIdentityRestart: true,
            dueTasks: 1,
            dueTasksWhileRestartVisible: 0,
        })
        await mount()
        expect(latest?.decision.zone?.id).toBe('blocked-card')
        await click(`${action}-blocked-card`)
        expect(latest?.decision.zone?.id).toBe('verification-due')
        expect(readLedger('user-a')['blocked-card']?.version).toBe('blocked-card:restart-identity:provider_rejected')
    }
)

test('a changed restart reason resurfaces, while an unrelated due task still takes priority', async () => {
    const first = 'blocked-card:restart-identity:first'
    mockState = state({
        ...BEFORE_ACTIVATION,
        blockedCardId: first,
        blockedIdentityRestart: true,
        dueTasks: 1,
        dueTasksWhileRestartVisible: 0,
    })
    const view = await mount()
    await click('dismiss-blocked-card')
    expect(latest?.decision.zone?.id).toBe('verification-due')
    mockState = state({
        ...BEFORE_ACTIVATION,
        blockedCardId: 'blocked-card:restart-identity:second',
        blockedIdentityRestart: true,
        dueTasks: 1,
        dueTasksWhileRestartVisible: 0,
    })
    await rerender(view)
    expect(latest?.decision.zone?.id).toBe('blocked-card')
    mockState = state({
        ...BEFORE_ACTIVATION,
        blockedCardId: 'blocked-card:restart-identity:second',
        blockedIdentityRestart: true,
        dueTasks: 2,
        dueTasksWhileRestartVisible: 1,
    })
    await rerender(view)
    expect(latest?.decision.zone?.id).toBe('verification-due')
})

test('a restart dismissed by one account remains visible for a different account', async () => {
    const scenario = {
        ...BEFORE_ACTIVATION,
        blockedCardId: 'blocked-card:restart-identity:first',
        blockedIdentityRestart: true,
        dueTasks: 1,
        dueTasksWhileRestartVisible: 0,
    }
    mockState = state(scenario)
    const view = await mount()
    await click('dismiss-blocked-card')
    expect(latest?.decision.zone?.id).toBe('verification-due')
    mockState = state({ ...scenario, userId: 'user-b' })
    await rerender(view)
    expect(latest?.decision.zone?.id).toBe('blocked-card')
    expect(readLedger('user-b')['blocked-card']?.dismissedAt).toBeUndefined()
})
