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
jest.mock('../journeyState', () => ({ useJourneyState: () => mockState }))

let mockOverlayOpen = false
jest.mock('@/utils/overlay-visibility', () => ({ useAnyOverlayOpen: () => mockOverlayOpen }))

import { AttentionProvider, resetAttentionSessionForTests, useAttention } from '../AttentionProvider'
import { updateUserPreferences } from '@/utils/general.utils'

const state = (overrides: Partial<JourneyState> = {}): JourneyState => ({
    now: Date.parse('2026-10-11T12:00:00Z'),
    userId: 'user-a',
    userLoaded: true,
    isNative: true,
    route: 'home',
    consent: { status: 'needed', versions: ['2026-10-01'] },
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
    card: { loaded: true, needsSetup: false },
    postAuthRedirect: false,
    balance: { loaded: true, usd: 0 },
    migration: { on: false },
    push: { ready: true, unanswered: false },
    showEarlyUserModal: true,
    ...overrides,
})

let renders = 0
function Probe() {
    renders++
    const { decision, dismissed } = useAttention()
    return (
        <div>
            <span data-testid="interrupt">{decision.interrupt ?? 'none'}</span>
            <span data-testid="zone">{decision.zone?.id ?? 'none'}</span>
            <button onClick={() => dismissed('legal-reconsent')}>dismiss-terms</button>
        </div>
    )
}

beforeEach(() => {
    window.localStorage.clear()
    mockCapture.mockClear()
    resetAttentionSessionForTests()
    mockOverlayOpen = false
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
        shadow: true,
        interrupt: 'legal-reconsent',
        zone: 'checklist',
        candidates: ['legal-reconsent', 'checklist', 'early-user'],
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

test('a user-opened overlay suspends every pick', async () => {
    mockOverlayOpen = true
    render(
        <AttentionProvider>
            <Probe />
        </AttentionProvider>
    )
    await act(async () => {})
    expect(screen.getByTestId('interrupt').textContent).toBe('none')
    expect(screen.getByTestId('zone').textContent).toBe('none')
})
