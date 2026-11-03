/**
 * Phase 2 surfaces' props contract: each prompt is render-only. It shows the
 * moment the manager mounts it, and reports the user's answer through
 * `onActed` / `onDismissed` / `onSnoozed` instead of deciding anything itself.
 */
import React from 'react'
import { act, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test-utils/intl'
import type { GrantSessionKeyError } from '@/hooks/wallet/useGrantSessionKey'

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
    capture: (...args: unknown[]) => mockCapture(...args),
}))

const mockCaptureException = jest.fn()
const mockCaptureMessage = jest.fn()
jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
    captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}))

const mockGetStatus = jest.fn()
const mockAccept = jest.fn()
jest.mock('@/services/consent', () => ({
    consentApi: {
        getStatus: (...args: unknown[]) => mockGetStatus(...args),
        accept: (...args: unknown[]) => mockAccept(...args),
    },
    acceptedLegalDocument: (doc: string | { slug: string }) => {
        const slug = typeof doc === 'string' ? doc : doc.slug
        return jest.requireActual('@/services/consent').acceptedLegalDocument(slug)
    },
}))

let mockUser: { user: { userId: string; username: string }; showEarlyUserModal?: boolean } | null = null
const mockFetchUser = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser, fetchUser: mockFetchUser }),
}))

const mockUpdateUserById = jest.fn()
jest.mock('@/app/actions/users', () => ({
    updateUserById: (...args: unknown[]) => mockUpdateUserById(...args),
}))

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/home',
    useSearchParams: () => new URLSearchParams(),
}))

const mockGetStoredRedirect = jest.fn()
const mockClearRedirectUrl = jest.fn()
const mockGenerateInviteCodeLink = jest.fn((_username: string, _source?: string, _origin?: string) => ({
    inviteLink: 'https://peanut.me/invite?code=TEST',
}))
jest.mock('@/utils/general.utils', () => ({
    ...jest.requireActual('@/utils/general.utils'),
    getStoredRedirect: (...args: unknown[]) => mockGetStoredRedirect(...args),
    clearRedirectUrl: (...args: unknown[]) => mockClearRedirectUrl(...args),
    generateInviteCodeLink: (username: string, source?: string, origin?: string) =>
        mockGenerateInviteCodeLink(username, source, origin),
}))

jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isVerified: true }),
}))

const mockRequestPermission = jest.fn()
const mockAfterPermissionAttempt = jest.fn()
jest.mock('@/hooks/useNotifications', () => ({
    markPushPromptShownThisSession: jest.fn(),
    useNotifications: () => ({
        requestPermission: mockRequestPermission,
        afterPermissionAttempt: mockAfterPermissionAttempt,
        isRequestingPermission: false,
        showPermissionModal: false,
        promptTrigger: null,
        closePermissionModal: jest.fn(),
    }),
}))

jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))

jest.mock('@/hooks/useZeroDevFlow', () => ({ useZeroDevFlow: () => ({ isKernelClientReady: true }) }))
const mockGrant = jest.fn<Promise<{ ok: boolean; overviewFresh?: boolean }>, []>()
let mockLastError: GrantSessionKeyError | null = null
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({
    useGrantSessionKey: () => ({ grant: mockGrant, isGranting: false, lastError: mockLastError }),
}))
type MockCard = { id: string; status: string; hasWithdrawApproval: boolean }
let mockCards: MockCard[] = []
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({
        overview: { cards: mockCards, status: { contractAddress: '0xabc', coordinatorAddress: '0xdef' } },
    }),
}))

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: {
        visible: boolean
        title?: React.ReactNode
        description?: React.ReactNode
        content?: React.ReactNode
        onClose?: () => void
        checkbox?: { text: string; checked: boolean; onChange: (checked: boolean) => void }
        ctas?: { text: string; disabled?: boolean; onClick: (e?: unknown) => void }[]
        tertiaryCta?: { text: string; disabled?: boolean; onClick?: (e?: unknown) => void }
    }) => {
        if (!props.visible) return null
        const checkbox = props.checkbox
        return (
            <div data-testid="modal">
                <h3>{props.title}</h3>
                <div>{props.description}</div>
                <div>{props.content}</div>
                {checkbox && (
                    <input
                        type="checkbox"
                        data-testid="consent-checkbox"
                        checked={checkbox.checked}
                        onChange={(e) => checkbox.onChange(e.target.checked)}
                    />
                )}
                {props.ctas?.map((c) => (
                    <button key={c.text} disabled={c.disabled} onClick={() => c.onClick()}>
                        {c.text}
                    </button>
                ))}
                {props.tertiaryCta && (
                    <button disabled={props.tertiaryCta.disabled} onClick={() => props.tertiaryCta?.onClick?.()}>
                        {props.tertiaryCta.text}
                    </button>
                )}
                {props.onClose && <button onClick={() => props.onClose?.()}>modal-close</button>}
            </div>
        )
    },
}))

jest.mock('@/components/Global/DocsLink', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))
jest.mock('@/components/Global/PeanutMascot/PeanutMascotScene', () => ({ PeanutMascotScene: () => null }))
jest.mock('@/components/0_Bruddle/IconBubble', () => ({ IconBubble: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

/** Props are checked at runtime per test, so one surface's mismatch never hides another's result. */
type Surface = React.ComponentType<Record<string, unknown>>
const asSurface = (component: unknown) => component as Surface

let queryClient: QueryClient
const props = (askId: string) => ({
    askId,
    presentation: askId === 'early-user' || askId === 'balance-backup' ? 'drawer' : 'modal',
    onActed: jest.fn(),
    onDismissed: jest.fn(),
    onSnoozed: jest.fn(),
})

function renderSurface(component: unknown, surfaceProps: Record<string, unknown>) {
    const Component = asSurface(component)
    return renderWithIntl(
        <QueryClientProvider client={queryClient}>
            <Component {...surfaceProps} />
        </QueryClientProvider>
    )
}

beforeAll(() => {
    Element.prototype.getAnimations = () => []
})

beforeEach(() => {
    jest.clearAllMocks()
    mockSavePreferences.mockReset().mockResolvedValue({ push: true })
    mockSessionCurrent = true
    window.localStorage.clear()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockUser = { user: { userId: 'alice', username: 'alice' }, showEarlyUserModal: true }
    mockUpdateUserById.mockResolvedValue({})
    mockAccept.mockResolvedValue({ recorded: 1 })
    mockGetStatus.mockResolvedValue({
        needsReConsent: true,
        documents: [{ slug: 'terms', currentVersion: '2099-01-01', needsAcceptance: true }],
    })
    mockRequestPermission.mockResolvedValue(undefined)
    mockAfterPermissionAttempt.mockResolvedValue(undefined)
    mockLastError = null
    mockGrant.mockResolvedValue({ ok: false })
    mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: false }]
})

import HomePushPrompt from '../surfaces/HomePushPrompt'
import PushCard from '../surfaces/zone/PushCard'
const mockSavePreferences = jest.fn()
let mockSessionCurrent = true
jest.mock('@/hooks/useSessionFence', () => ({
    useSessionFence: () => () => ({ userId: 'alice', current: () => mockSessionCurrent }),
}))
jest.mock('../AttentionProvider', () => ({
    useAttention: () => ({ state: { userId: 'alice' }, holdPushPrompt: jest.fn(), holdPushCard: jest.fn() }),
}))
jest.mock('@/services/notifications', () => ({
    notificationsApi: { savePreferences: (...args: unknown[]) => mockSavePreferences(...args) },
}))
jest.mock('@/components/Notifications/SetupNotificationsModal', () => ({
    SetupNotificationsPrompt: ({ onAllow, error }: { onAllow: () => void; error?: string }) => (
        <>
            <button onClick={onAllow}>Allow push</button>
            {error && <p role="alert">{error}</p>}
        </>
    ),
}))
jest.mock('@/components/Home/HomeCarouselCTA/CarouselCTA', () => ({
    __esModule: true,
    default: ({ onClick, onClose }: { onClick: () => void; onClose: () => void }) => (
        <>
            <button onClick={onClick}>Allow push</button>
            <button onClick={onClose}>Close card</button>
        </>
    ),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ attention: jest.fn() }) }))
test.each(['denied', 'default', 'error', 'granted'])(
    'Home permission result %s settles accurately',
    async (outcome) => {
        mockSessionCurrent = true
        if (outcome === 'error') mockRequestPermission.mockRejectedValueOnce(new Error('synthetic failure'))
        else mockRequestPermission.mockResolvedValueOnce(outcome)
        const p = props('push-home-fallback')
        renderSurface(HomePushPrompt, p)
        await act(async () => {
            screen.getByText('Allow push').click()
        })
        expect(p.onActed).toHaveBeenCalledTimes(outcome === 'granted' ? 1 : 0)
        expect(p.onSnoozed).toHaveBeenCalledTimes(outcome === 'denied' || outcome === 'default' ? 1 : 0)
    }
)
test('Home grant waits for the account preference save before reporting success', async () => {
    mockSessionCurrent = true
    mockRequestPermission.mockResolvedValueOnce('granted')
    let resolveSave!: (value: { push: boolean }) => void
    mockSavePreferences.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveSave = resolve
            })
    )
    const p = props('push-home-fallback')
    renderSurface(HomePushPrompt, p)
    await act(async () => {
        screen.getByText('Allow push').click()
        await Promise.resolve()
    })
    expect(mockSavePreferences).toHaveBeenCalledWith({ pushPermission: 'granted', push: true }, 'alice')
    expect(p.onActed).not.toHaveBeenCalled()
    await act(async () => {
        resolveSave({ push: true })
        await Promise.resolve()
    })
    expect(p.onActed).toHaveBeenCalledTimes(1)
})

test('Home grant does not report success when saving fails or the account changes', async () => {
    mockSessionCurrent = true
    mockRequestPermission.mockResolvedValueOnce('granted')
    let rejectSave!: (error: Error) => void
    mockSavePreferences.mockImplementationOnce(
        () =>
            new Promise((_, reject) => {
                rejectSave = reject
            })
    )
    const p = props('push-home-fallback')
    renderSurface(HomePushPrompt, p)
    await act(async () => {
        screen.getByText('Allow push').click()
        await Promise.resolve()
    })
    mockSessionCurrent = false
    await act(async () => {
        rejectSave(new Error('offline'))
        await Promise.resolve()
    })
    expect(p.onActed).not.toHaveBeenCalled()
})

test('an account change before OS grant prevents a preference save', async () => {
    let resolvePermission!: (value: string) => void
    mockRequestPermission.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolvePermission = resolve
            })
    )
    const p = props('push-home-fallback')
    renderSurface(HomePushPrompt, p)
    await act(async () => {
        screen.getByText('Allow push').click()
        await Promise.resolve()
    })
    mockSessionCurrent = false
    await act(async () => {
        resolvePermission('granted')
        await Promise.resolve()
    })
    expect(mockSavePreferences).not.toHaveBeenCalled()
    expect(p.onActed).not.toHaveBeenCalled()
})

test('a save completing after an account change cannot report success', async () => {
    mockRequestPermission.mockResolvedValueOnce('granted')
    let resolveSave!: (value: { push: boolean }) => void
    mockSavePreferences.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                resolveSave = resolve
            })
    )
    const p = props('push-home-fallback')
    renderSurface(HomePushPrompt, p)
    await act(async () => {
        screen.getByText('Allow push').click()
        await Promise.resolve()
    })
    mockSessionCurrent = false
    await act(async () => {
        resolveSave({ push: true })
        await Promise.resolve()
    })
    expect(mockSavePreferences).toHaveBeenCalledWith({ pushPermission: 'granted', push: true }, 'alice')
    expect(p.onActed).not.toHaveBeenCalled()
})

test('a failed preference save stays visible and can be retried', async () => {
    mockRequestPermission.mockResolvedValue('granted')
    mockSavePreferences.mockRejectedValueOnce(new Error('offline'))
    const p = props('push-home-fallback')
    renderSurface(HomePushPrompt, p)
    await act(async () => {
        screen.getByText('Allow push').click()
        await Promise.resolve()
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(p.onActed).not.toHaveBeenCalled()
    await act(async () => {
        screen.getByText('Allow push').click()
        await Promise.resolve()
    })
    expect(p.onActed).toHaveBeenCalledTimes(1)
})
test.each(['denied', 'default', 'error', 'granted'])(
    'native card permission result %s settles accurately',
    async (outcome) => {
        mockSessionCurrent = true
        if (outcome === 'error') mockRequestPermission.mockRejectedValueOnce(new Error('synthetic failure'))
        else mockRequestPermission.mockResolvedValueOnce(outcome)
        const p = props('push-home-fallback')
        renderSurface(PushCard, p)
        await act(async () => {
            screen.getByText('Allow push').click()
        })
        expect(p.onActed).toHaveBeenCalledTimes(outcome === 'granted' ? 1 : 0)
        expect(p.onSnoozed).toHaveBeenCalledTimes(outcome === 'denied' || outcome === 'default' ? 1 : 0)
        expect(p.onDismissed).not.toHaveBeenCalled()
    }
)
