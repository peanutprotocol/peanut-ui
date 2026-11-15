/**
 * Phase 1 is shadow mode: the provider decides next to the old prompts and
 * reports once per distinct decision. It must also be cheap to mount: the
 * ledger snapshot has to be stable or useSyncExternalStore re-renders forever.
 */
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
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
let mockModals:
    | {
          isQRScannerOpen?: boolean
          isSecurityVerificationOpen?: boolean
          isSupportModalOpen?: boolean
          isGetAppModalOpen?: boolean
          isSignInModalOpen?: boolean
      }
    | undefined
jest.mock('@/context/ModalsContext', () => ({ useModalsContextOptional: () => mockModals }))
let mockPathname = '/home'
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))
const NO_KILL_SWITCHES = { disabledAttentionAsks: [] as string[] }
let mockKillSwitches = NO_KILL_SWITCHES
const mockKillSwitchListeners = new Set<() => void>()
jest.mock('@/features/kill-switches/useKillSwitches', () => {
    const { useSyncExternalStore } = jest.requireActual('react')
    return {
        useKillSwitches: () =>
            useSyncExternalStore(
                (listener: () => void) => {
                    mockKillSwitchListeners.add(listener)
                    return () => mockKillSwitchListeners.delete(listener)
                },
                () => mockKillSwitches
            ),
    }
})
const setKillSwitches = (next: typeof NO_KILL_SWITCHES) => {
    mockKillSwitches = next
    mockKillSwitchListeners.forEach((listener) => listener())
}
// asks whose rules throw, to show one broken ask leaves the others deciding
const mockBroken = new Set<string>()
jest.mock('../registry', () => {
    const actual = jest.requireActual('../registry')
    return {
        ...actual,
        ASKS: actual.ASKS.map((ask: { id: string; eligible: (s: unknown) => unknown }) => ({
            ...ask,
            eligible: (s: unknown) => {
                if (mockBroken.has(ask.id)) throw new Error(`${ask.id} rule exploded`)
                return ask.eligible(s)
            },
        })),
    }
})

import {
    AttentionProvider,
    ENGINE_RETRIES,
    resetAttentionSessionForTests,
    useAttentionOptional,
} from '../AttentionProvider'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import { ledgerActions } from '../ledger'
import { AttentionInterrupt } from '../AttentionInterrupt'
import { HomeAttention } from '../AttentionZone'

const state = (overrides: Partial<JourneyState> = {}): JourneyState => ({
    capNudge: null,
    maintenance: 'none',
    now: Date.parse('2026-10-11T12:00:00Z'),
    userId: 'user-a',
    userLoaded: true,
    isNative: true,
    deviceType: 'ios',
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
    card: { loaded: true, needsSetup: false, activeCardId: null, setupPath: 'none', needsFunding: false },
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

test('a successful legal write reports once after refetch closes the prompt without dismissing newer terms', async () => {
    let accept: (() => void) | undefined
    function LegalProbe() {
        const attention = useAttentionOptional()
        if (attention?.state.consent.versions[0] === '2026-10-01') accept = attention.recordLegalAcceptance
        return null
    }
    const view = render(
        <AttentionProvider>
            <LegalProbe />
        </AttentionProvider>
    )
    await act(async () => {})
    expect(accept).toBeDefined()
    mockState = state({ consent: { status: 'needed', versions: ['2026-11-01'], documents: [] } })
    view.rerender(
        <AttentionProvider>
            <LegalProbe />
        </AttentionProvider>
    )
    await act(async () => {})
    act(() => {
        accept?.()
        accept?.()
    })
    const events = mockCapture.mock.calls.filter(
        ([event, properties]) => event === 'attention_acted' && properties.ask === 'legal-reconsent'
    )
    expect(events).toHaveLength(1)
    expect(getUserPreferences('user-a')?.attention?.['legal-reconsent']?.dismissedAt).toBeUndefined()
})

test('a legal callback from an old session stays stale after switching away and back', async () => {
    let accept: (() => void) | undefined
    function LegalProbe() {
        const attention = useAttentionOptional()
        if (!accept && attention) accept = attention.recordLegalAcceptance
        return null
    }
    const view = render(
        <AttentionProvider>
            <LegalProbe />
        </AttentionProvider>
    )
    await act(async () => {})
    mockState = state({ userId: 'user-b' })
    view.rerender(
        <AttentionProvider>
            <LegalProbe />
        </AttentionProvider>
    )
    await act(async () => {})
    mockState = state()
    view.rerender(
        <AttentionProvider>
            <LegalProbe />
        </AttentionProvider>
    )
    await act(async () => {})
    act(() => accept?.())
    expect(
        mockCapture.mock.calls.filter(
            ([event, properties]) => event === 'attention_acted' && properties.ask === 'legal-reconsent'
        )
    ).toHaveLength(0)
})

test('a held push save yields to a user-opened overlay', async () => {
    function PushProbe() {
        const attention = useAttentionOptional()
        if (!attention) return null
        return (
            <>
                <span data-testid="held-pick">{attention.decision.interrupt ?? 'none'}</span>
                <button
                    onClick={() => {
                        attention.opened('push-home-fallback')
                        attention.holdPushPrompt(true)
                    }}
                >
                    Hold
                </button>
            </>
        )
    }
    mockState = state({ consent: { status: 'clear', versions: [], documents: [] } })
    const view = render(
        <AttentionProvider>
            <PushProbe />
        </AttentionProvider>
    )
    await act(async () => {})
    fireEvent.click(screen.getByText('Hold'))
    mockOverlayOpen = true
    view.rerender(
        <AttentionProvider>
            <PushProbe />
        </AttentionProvider>
    )
    await act(async () => {})
    expect(screen.getByTestId('held-pick')).toHaveTextContent('none')
})

let renders = 0
function Probe() {
    renders++
    const attention = useAttentionOptional()
    if (!attention) return <span data-testid="no-manager" />
    const { decision, opened, dismissed } = attention
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
    mockPathname = '/home'
    mockKillSwitches = NO_KILL_SWITCHES
    mockBroken.clear()
    renders = 0
})

test.each(['isSupportModalOpen', 'isGetAppModalOpen', 'isSignInModalOpen'] as const)(
    'the requested %s holds manager interrupts before its lazy overlay mounts',
    async (flag) => {
        mockModals = { [flag]: true }
        render(
            <AttentionProvider>
                <Probe />
            </AttentionProvider>
        )
        await act(async () => {})
        expect(screen.getByTestId('interrupt')).toHaveTextContent('none')
    }
)

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

test('after a throw, the hosts the layout always mounts render nothing instead of throwing again', async () => {
    mockThrow = new Error('selector exploded')
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(
        <AttentionProvider>
            <div>app-shell</div>
            <AttentionInterrupt />
            <HomeAttention />
        </AttentionProvider>
    )
    await act(async () => {})
    expect(screen.getByText('app-shell')).toBeInTheDocument()
    expect(screen.queryByTestId('home-attention')).not.toBeInTheDocument()
    expect(mockSentry).toHaveBeenCalledTimes(1)
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

test('the server answer arriving is reported even when the visible pick stays the same', async () => {
    const { rerender } = render(
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    mockServer = { version: 1, ranking: [], verdicts: {}, nextAsk: 'legal-reconsent' }
    rerender(
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    expect(screen.getByTestId('interrupt').textContent).toBe('legal-reconsent')
    const reports = mockCapture.mock.calls.filter(([event]) => event === 'attention_decided').map(([, p]) => p)
    expect(reports.map((p) => p.ranking_source)).toEqual(['local', 'server'])
    expect(reports[1]).toMatchObject({ interrupt: 'legal-reconsent', server_next_ask: 'legal-reconsent' })
})

class AppBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    state = { error: null as Error | null }
    static getDerivedStateFromError(error: Error) {
        return { error }
    }
    render() {
        return this.state.error ? (
            <button onClick={() => this.setState({ error: null })}>{`app error: ${this.state.error.message}`}</button>
        ) : (
            this.props.children
        )
    }
}

test("a page's own crash goes to the app's boundary, is not filed as an attention crash, and leaves the manager on", async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    let crashes = 1
    function Page() {
        React.useEffect(() => {
            if (crashes > 0) {
                crashes--
                throw new Error('page exploded')
            }
        }, [])
        return <div>page</div>
    }
    render(
        <AppBoundary>
            <AttentionProvider>
                <Page />
                <Probe />
            </AttentionProvider>
        </AppBoundary>
    )
    await act(async () => {})
    expect(mockSentry).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tags: { feature: 'attention' } })
    )
    // the app's error page, then its reset: the manager is still there
    await act(async () => {
        screen.getByText('app error: page exploded').click()
    })
    expect(screen.getByText('page')).toBeInTheDocument()
    expect(screen.getByTestId('interrupt')).toBeInTheDocument()
    spy.mockRestore()
})

test('an ask whose rule throws drops alone: the others still decide, and Sentry names the ask once', async () => {
    updateUserPreferences('user-a', { sessionCount: 3 })
    mockBroken.add('legal-reconsent')
    render(
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    expect(screen.getByTestId('interrupt').textContent).not.toBe('legal-reconsent')
    expect(screen.getByTestId('zone').textContent).toBe('checklist')
    expect(mockSentry).toHaveBeenCalledTimes(1)
    expect(mockSentry).toHaveBeenCalledWith(expect.objectContaining({ message: 'legal-reconsent rule exploded' }), {
        tags: { feature: 'attention', ask: 'legal-reconsent', rule: 'eligible' },
    })
    expect(mockCapture).toHaveBeenCalledWith(
        'attention_crashed',
        expect.objectContaining({ ask: 'legal-reconsent', rule: 'eligible' })
    )
})

test('the kill switch turns an ask off even while it is the pick; "*" turns every ask off', async () => {
    updateUserPreferences('user-a', { sessionCount: 3 })
    render(
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    expect(screen.getByTestId('interrupt').textContent).toBe('legal-reconsent')
    await act(async () => setKillSwitches({ disabledAttentionAsks: ['legal-reconsent'] }))
    expect(screen.getByTestId('interrupt').textContent).not.toBe('legal-reconsent')
    expect(screen.getByTestId('zone').textContent).toBe('checklist')
    await act(async () => setKillSwitches({ disabledAttentionAsks: ['*'] }))
    expect(screen.getByTestId('interrupt').textContent).toBe('none')
    expect(screen.getByTestId('zone').textContent).toBe('none')
    await act(async () => setKillSwitches(NO_KILL_SWITCHES))
    expect(screen.getByTestId('interrupt').textContent).toBe('legal-reconsent')
})

function AmountField() {
    const [amount, setAmount] = React.useState('')
    return <input aria-label="amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
}

test('an engine crash mid-session keeps the page mounted and what the user typed', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(
        <AttentionProvider>
            <AmountField />
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    const input = screen.getByLabelText('amount') as HTMLInputElement
    fireEvent.change(input, { target: { value: '42' } })
    mockThrow = new Error('selector exploded')
    // a ledger write re-runs the engine, which now throws
    await act(async () => ledgerActions.shown('user-a', 'checklist', Date.now(), 'zone', 1))
    expect(screen.getByLabelText('amount')).toBe(input)
    expect(input.value).toBe('42')
    expect(screen.getByTestId('no-manager')).toBeInTheDocument()
    expect(mockSentry).toHaveBeenCalledTimes(1)
    spy.mockRestore()
})

test(`a crashed engine starts again on the next route, at most ${ENGINE_RETRIES} times per load`, async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const ui = () => (
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    mockThrow = new Error('selector exploded')
    const { rerender } = render(ui())
    await act(async () => {})
    expect(screen.getByTestId('no-manager')).toBeInTheDocument()

    // the same route never retries
    rerender(ui())
    await act(async () => {})
    expect(mockSentry).toHaveBeenCalledTimes(1)

    // each new route is one more try while the data stays broken
    for (const [index, route] of ['/send', '/request'].entries()) {
        mockPathname = route
        rerender(ui())
        await act(async () => {})
        expect(mockSentry).toHaveBeenCalledTimes(index + 2)
    }

    // the budget is spent: a later route stays without the manager, even with good data
    mockThrow = null
    mockPathname = '/profile'
    rerender(ui())
    await act(async () => {})
    expect(screen.getByTestId('no-manager')).toBeInTheDocument()
    expect(mockSentry).toHaveBeenCalledTimes(1 + ENGINE_RETRIES)
    spy.mockRestore()
})

test('a crash the next route no longer hits brings the manager back', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const ui = () => (
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    mockThrow = new Error('selector exploded')
    const { rerender } = render(ui())
    await act(async () => {})
    expect(screen.getByTestId('no-manager')).toBeInTheDocument()
    mockThrow = null
    mockPathname = '/send'
    rerender(ui())
    await act(async () => {})
    expect(screen.getByTestId('interrupt')).toBeInTheDocument()
    spy.mockRestore()
})
