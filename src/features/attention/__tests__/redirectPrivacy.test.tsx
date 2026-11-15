/**
 * Phase 2 orchestration contract: interrupts render through the manager.
 *
 * The real modals are stubbed (`../surfaces`) so these tests pin the manager's
 * lifecycle, not any one prompt's UI. Every "handle" item of the phase-2
 * failure list that lives in the orchestration has at least one test here.
 */
/**
 * Phase 2 orchestration contract: interrupts render through the manager.
 *
 * The real modals are stubbed (`../surfaces`) so these tests pin the manager's
 * lifecycle, not any one prompt's UI. Every "handle" item of the phase-2
 * failure list that lives in the orchestration has at least one test here.
 */
/**
 * Phase 2 orchestration contract: interrupts render through the manager.
 *
 * The real modals are stubbed (`../surfaces`) so these tests pin the manager's
 * lifecycle, not any one prompt's UI. Every "handle" item of the phase-2
 * failure list that lives in the orchestration has at least one test here.
 */
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

import { AttentionProvider, resetAttentionSessionForTests } from '../AttentionProvider'

import { updateUserPreferences } from '@/utils/general.utils'

const interruptModule = require('../AttentionInterrupt')
const AttentionInterrupt: React.ComponentType = interruptModule.AttentionInterrupt ?? interruptModule.default

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

function Probe() {
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

async function click(text: string) {
    await act(async () => {
        screen.getByText(text).click()
    })
}

const surfacesInDom = () =>
    Array.from(document.querySelectorAll('[data-testid^="surface-"]')).map((el) =>
        el.getAttribute('data-testid')!.replace('surface-', '')
    )

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
    updateUserPreferences('user-a', { sessionCount: 3 })
})

afterEach(() => {
    jest.restoreAllMocks()
})

import { setRedirectUrl, getStoredRedirect } from '@/utils/general.utils'
import { flushLedgerSyncForTests } from '../ledgerSync'
const mockUpdateUser = jest.fn().mockResolvedValue({})
jest.mock('@/app/actions/users', () => ({ updateUserById: (...args: unknown[]) => mockUpdateUser(...args) }))
test('dismissing a claim follow-up must not upload its bearer secret', async () => {
    const destination = '/claim?c=42161&v=v4.4&i=552#p=synthetic-test-secret'
    setRedirectUrl(destination)
    expect(getStoredRedirect()?.destination).toBe(destination)
    mockState = state({ postAuthRedirect: true, postAuthRedirectDestination: getStoredRedirect()!.destination })
    await mount()
    expect(surfacesInDom()).toContain('post-verification-action')
    await click('dismiss-post-verification-action')
    await flushLedgerSyncForTests()
    expect(mockUpdateUser).toHaveBeenCalled()
    expect(JSON.stringify(mockUpdateUser.mock.calls)).not.toContain('synthetic-test-secret')
})
