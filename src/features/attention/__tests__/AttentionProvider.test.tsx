/**
 * Phase 1 is shadow mode: the provider decides next to the old prompts and
 * reports once per distinct decision. It must also be cheap to mount: the
 * ledger snapshot has to be stable or useSyncExternalStore re-renders forever.
 */
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import type { JourneyState } from '../types'

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({ capture: (...args: unknown[]) => mockCapture(...args) }))

let mockState: JourneyState
let mockThrow: Error | null = null
jest.mock('../journeyState', () => ({
    useJourneyState: () => {
        if (mockThrow) throw mockThrow
        return mockState
    },
}))
const mockSentry = jest.fn()
jest.mock('@sentry/nextjs', () => ({ captureException: (...args: unknown[]) => mockSentry(...args) }))

let mockOverlayOpen = false
let mockServer: unknown = undefined
jest.mock('../serverAttention', () => ({
    ...jest.requireActual('../serverAttention'),
    useServerAttention: () => mockServer,
}))
jest.mock('@/utils/overlay-visibility', () => ({ useAnyOverlayOpen: () => mockOverlayOpen }))
let mockModals: { isQRScannerOpen: boolean; isSecurityVerificationOpen: boolean } | undefined
jest.mock('@/context/ModalsContext', () => ({ useModalsContextOptional: () => mockModals }))

import { AttentionProvider, resetAttentionSessionForTests, useAttention } from '../AttentionProvider'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'

const state = (overrides: Partial<JourneyState> = {}): JourneyState => ({
    capNudge: null,
    maintenance: 'none',
    now: Date.parse('2026-10-11T12:00:00Z'),
    userId: 'user-a',
    userLoaded: true,
    isNative: true,
    route: 'home',
    consent: { status: 'needed', versions: ['2026-10-01'], documents: [] },
    identity: {
        status: 'not_started',
        isVerified: false,
        needsAction: false,
        isTerminalFailure: false,
        isRegionRestricted: false,
    },
    onboarding: {
        verify: 'todo',
        addMoneyDone: false,
        firstPaymentDone: false,
        firstPaymentRoute: 'card_qr',
        step: 'verify',
    },
    blockedCardId: null,
    dueTasks: 0,
    card: { loaded: true, needsSetup: false, activeCardId: null },
    postAuthRedirect: false,
    postAuthRedirectDestination: null,
    balance: { loaded: true, usd: 0 },
    migration: { on: false },
    push: { ready: true, unanswered: false, promptedThisSession: false, notEnabled: false },
    showEarlyUserModal: true,
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
    serverLedger: undefined,
    arrival: 'none',
    ...overrides,
})

let renders = 0
function Probe() {
    renders++
    const { decision, opened, dismissed } = useAttention()
    return (
        <div>
            <span data-testid="interrupt">{decision.interrupt ?? 'none'}</span>
            <span data-testid="zone">{decision.zone?.id ?? 'none'}</span>
            <button
                onClick={() => {
                    // a settle only counts for the surface on screen
                    opened('legal-reconsent')
                    // a settle for an ask that is not on screen writes nothing
                    dismissed('early-user')
                    dismissed('legal-reconsent')
                }}
            >
                dismiss-terms
            </button>
            <button
                onClick={() => {
                    // StrictMode and re-renders call the report twice for one show
                    opened('legal-reconsent')
                    opened('legal-reconsent')
                }}
            >
                open-terms-twice
            </button>
        </div>
    )
}

beforeEach(() => {
    window.localStorage.clear()
    mockCapture.mockClear()
    resetAttentionSessionForTests()
    mockOverlayOpen = false
    mockModals = undefined
    mockServer = undefined
    mockThrow = null
    mockSentry.mockClear()
    mockState = state()
    renders = 0
})

test('decides, reports once, and does not re-render in a loop', async () => {
    updateUserPreferences('user-a', { sessionCount: 3 })
    render(
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    expect(screen.getByTestId('interrupt').textContent).toBe('legal-reconsent')
    expect(screen.getByTestId('zone').textContent).toBe('checklist')
    expect(renders).toBeLessThan(6)
    const reports = mockCapture.mock.calls.filter(([event]) => event === 'attention_decided')
    expect(reports).toHaveLength(1)
    expect(reports[0][1]).toMatchObject({
        shadow: false,
        interrupt: 'legal-reconsent',
        zone: 'checklist',
        candidates: ['legal-reconsent', 'checklist', 'verification-deadline', 'early-user'],
    })
})

test('a ledger write re-decides: dismissing terms hands the next evaluation on', async () => {
    render(
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    await act(async () => {
        screen.getByText('dismiss-terms').click()
    })
    expect(screen.getByTestId('interrupt').textContent).toBe('none')
    // the announcement cannot take over: first sessions, and the zone is busy
    const reports = mockCapture.mock.calls.filter(([event]) => event === 'attention_decided')
    expect(reports).toHaveLength(2)
    expect(reports[1][1]).toMatchObject({ interrupt: null, zone: 'checklist' })
})

test('reporting a show twice books it once', async () => {
    updateUserPreferences('user-a', { sessionCount: 2 })
    render(
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    await act(async () => {
        screen.getByText('open-terms-twice').click()
    })
    const shown = mockCapture.mock.calls.filter(([event]) => event === 'attention_shown')
    expect(shown).toHaveLength(1)
    expect(mockCapture.mock.calls.filter(([event]) => event === 'modal_shown')).toHaveLength(1)
    expect(getUserPreferences('user-a')?.attention?.['legal-reconsent']?.shownAt).toHaveLength(1)
})

test('a user-opened overlay stops new interrupts, keeps the zone, and reports suspension', async () => {
    mockOverlayOpen = true
    render(
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    expect(screen.getByTestId('interrupt').textContent).toBe('none')
    expect(screen.getByTestId('zone').textContent).toBe('checklist')
    const reports = mockCapture.mock.calls.filter(([event]) => event === 'attention_decided')
    expect(reports).toHaveLength(1)
    expect(reports[0][1]).toMatchObject({ interrupt: null, zone: 'checklist', suspended: true, overlay_open: true })
})

test.each([
    ['the QR scanner', { isQRScannerOpen: true, isSecurityVerificationOpen: false }],
    ['the passkey interstitial', { isQRScannerOpen: false, isSecurityVerificationOpen: true }],
])('%s counts as busy: no interrupt opens over it (the arrival CTA opens the scanner)', async (_, modals) => {
    mockModals = modals
    mockState = state({
        consent: { status: 'clear', versions: [], documents: [] },
        balance: { loaded: true, usd: 900 },
    })
    render(
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    expect(screen.getByTestId('interrupt').textContent).toBe('none')
    expect(screen.getByTestId('zone').textContent).toBe('checklist')
})

test('a throw inside the manager never takes the app down', async () => {
    mockThrow = new Error('selector exploded')
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(
        <AttentionProvider>
            <div>app-shell</div>
        </AttentionProvider>
    )
    await act(async () => {})
    expect(screen.getByText('app-shell')).toBeInTheDocument()
    expect(mockSentry).toHaveBeenCalledWith(mockThrow, expect.objectContaining({ tags: { feature: 'attention' } }))
    spy.mockRestore()
})

test('a server verdict overrides the local one and the report names its source', async () => {
    updateUserPreferences('user-a', { sessionCount: 3 })
    mockServer = { version: 1, ranking: [], verdicts: { 'legal-reconsent': 'done' }, nextAsk: 'early-user' }
    render(
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    expect(screen.getByTestId('interrupt').textContent).not.toBe('legal-reconsent')
    const reports = mockCapture.mock.calls.filter(([event]) => event === 'attention_decided')
    expect(reports.at(-1)?.[1]).toMatchObject({ ranking_source: 'server', server_next_ask: 'early-user' })
})

test('without a server answer the report says the ranking is local', async () => {
    render(
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    const reports = mockCapture.mock.calls.filter(([event]) => event === 'attention_decided')
    expect(reports.at(-1)?.[1]).toMatchObject({ ranking_source: 'local', server_next_ask: null })
})
