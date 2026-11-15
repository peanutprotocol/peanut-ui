import { createElement } from 'react'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'

// pins the pre-prompt rules: which money moment may ask (TASK-23251), and the
// Home fallback's dismissal logic (TASK-21145 / PR #2591) — legacy
// `notifModalClosed` bool, `notifModalClosedAt` timestamp, and the 14-day
// snooze.
//
// the hook keeps its state in a module-level store (init runs once per page),
// so tests share one module instance; resetPushPromptForTests() starts a fresh
// session before each test. tests that assert the prompt stays CLOSED first
// prove it would show under the same mocks (baseline true), then flip the
// mocks and offer again — a false can then only be a fresh decision, never
// leftover store state or a silent early-return on adapter failure.

// init registers the permission listener once per module; kept here because
// clearAllMocks wipes the call log between tests

const mockAdapter = {
    init: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    requestPermission: jest.fn().mockResolvedValue('default'),
    getPermission: jest.fn().mockResolvedValue('default'),
    isOptedIn: jest.fn().mockResolvedValue(false),
    onPermissionChange: jest.fn((_listener: (permissionState: string) => void) => {
        return () => {}
    }),
    onSubscriptionChange: jest.fn(() => () => {}),
    onNotificationClick: jest.fn(() => () => {}),
    onNotificationReceived: jest.fn(() => () => {}),
}
jest.mock('@/services/onesignal', () => ({
    getOneSignalAdapter: () => Promise.resolve(mockAdapter),
}))

// in-memory prefs store mirroring updateUserPreferences' merge behavior, so
// the once-only legacy conversion is observable across re-evaluations
let mockPrefs: Record<string, unknown> | undefined
const mockUpdateUserPreferences = jest.fn((_userId: string | undefined, partial: Record<string, unknown>) => {
    mockPrefs = { ...mockPrefs, ...partial }
})
jest.mock('@/utils/general.utils', () => ({
    getUserPreferences: () => mockPrefs,
    updateUserPreferences: (userId: string | undefined, partial: Record<string, unknown>) =>
        mockUpdateUserPreferences(userId, partial),
}))

let mockInterruptOpen = false
jest.mock('@/features/attention/interruptState', () => ({ isAttentionInterruptOpen: () => mockInterruptOpen }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
let mockUserId = 'user-1'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: mockUserId } } }),
    useOptionalAuth: () => ({ user: { user: { userId: mockUserId } } }),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
jest.mock('@/features/attention/AttentionProvider', () => ({
    useAttention: () => ({ holdPushPrompt: jest.fn(), state: { userId: mockUserId } }),
}))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
// renders the copy keys, so a test can read which promise the prompt makes
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, title, description }: { visible: boolean; title: string; description: string }) =>
        visible ? `${title} | ${description}` : null,
}))
const mockSentryCaptureException = jest.fn()
const mockSentryAddBreadcrumb = jest.fn()
jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockSentryCaptureException(...args),
    captureMessage: jest.fn(),
    addBreadcrumb: (...args: unknown[]) => mockSentryAddBreadcrumb(...args),
}))

import { PUSH_PROMPT_TRIGGERS, type PushPromptTrigger } from '@/constants/push-prompt.consts'
import { isSilenced } from '@/features/attention/decide'
import { pushHomeFallback } from '@/features/attention/registry'
import type { JourneyState, LedgerEntry } from '@/features/attention/types'

import { offerPushPrompt, resetPushPromptForTests, useNotifications } from '../useNotifications'

const DAY_MS = 24 * 60 * 60 * 1000

const { DEPOSIT_INTENT } = PUSH_PROMPT_TRIGGERS

async function offer(trigger: PushPromptTrigger) {
    await act(async () => {
        await offerPushPrompt(trigger)
    })
}

// a new app load: the one-prompt-per-session budget is spent per session
function newSession() {
    act(() => resetPushPromptForTests())
}

async function renderInitialized() {
    const rendered = renderHook(() => useNotifications())
    await waitFor(() => expect(rendered.result.current.oneSignalInitialized).toBe(true))
    return rendered
}

// a returning user who never dismissed anything sees the Home fallback — the
// baseline every stays-closed assertion is measured against

import HomePushPrompt from '@/features/attention/surfaces/HomePushPrompt'
jest.mock('@/components/Notifications/SetupNotificationsModal', () => ({
    __esModule: true,
    default: () => null,
    SetupNotificationsPrompt: ({ onClose }: { onClose: () => void }) =>
        require('react').createElement('button', { onClick: onClose }, 'Home Not now'),
}))
test('Home Not now spends this session pre-prompt budget', async () => {
    resetPushPromptForTests()
    mockPrefs = { sessionCount: 3 }
    const hook = await renderInitialized()
    mockInterruptOpen = true
    const onSnoozed = jest.fn(() => {
        mockPrefs = {
            ...mockPrefs,
            attention: { 'push-home-fallback': { snoozedUntil: new Date(Date.now() + 14 * DAY_MS).toISOString() } },
        }
        mockInterruptOpen = false
    })
    render(
        createElement(HomePushPrompt, {
            askId: 'push-home-fallback',
            presentation: 'modal',
            onActed: jest.fn(),
            onDismissed: jest.fn(),
            onSnoozed,
        })
    )
    await act(async () => {
        screen.getByText('Home Not now').click()
    })
    expect(onSnoozed).toHaveBeenCalled()
    expect(hook.result.current.promptShownThisSession).toBe(true)
    expect(hook.result.current.contextualPromptShownThisSession).toBe(false)
    await offer(DEPOSIT_INTENT)
    expect(hook.result.current.showPermissionModal).toBe(false)
})

test('active Home ledger snooze permits a contextual prompt in a later session', async () => {
    resetPushPromptForTests()
    mockInterruptOpen = false
    mockPrefs = { sessionCount: 3 }
    const hook = await renderInitialized()
    await offer(DEPOSIT_INTENT)
    expect(hook.result.current.showPermissionModal).toBe(true)
    newSession()
    mockPrefs = {
        sessionCount: 4,
        attention: { 'push-home-fallback': { snoozedUntil: new Date(Date.now() + DAY_MS).toISOString() } },
    }
    await offer(DEPOSIT_INTENT)
    expect(hook.result.current.showPermissionModal).toBe(true)
    const entry = (mockPrefs?.attention as Record<string, LedgerEntry>)['push-home-fallback']
    expect(
        isSilenced(pushHomeFallback, entry, {
            now: Date.now(),
            isNative: true,
            push: { unanswered: true },
        } as JourneyState)
    ).toBe(true)
})
