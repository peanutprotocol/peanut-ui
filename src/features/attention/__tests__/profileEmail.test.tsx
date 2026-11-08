/**
 * Phase 2 surfaces' props contract: each prompt is render-only. It shows the
 * moment the manager mounts it, and reports the user's answer through
 * `onActed` / `onDismissed` / `onSnoozed` instead of deciding anything itself.
 */
import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
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
        return { slug, version: `version-of-${slug}`, hash: 'a'.repeat(64) }
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
    useNotifications: () => ({
        requestPermission: mockRequestPermission,
        afterPermissionAttempt: mockAfterPermissionAttempt,
        isRequestingPermission: false,
        showPermissionModal: false,
        promptTrigger: null,
        closePermissionModal: jest.fn(),
    }),
}))

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
    window.localStorage.clear()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockUser = { user: { userId: 'alice', username: 'alice' }, showEarlyUserModal: true }
    mockUpdateUserById.mockResolvedValue({})
    mockAccept.mockResolvedValue({ recorded: 1 })
    mockGetStatus.mockResolvedValue({ needsReConsent: true, documents: [] })
    mockRequestPermission.mockResolvedValue(undefined)
    mockAfterPermissionAttempt.mockResolvedValue(undefined)
    mockLastError = null
    mockGrant.mockResolvedValue({ ok: false })
    mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: false }]
})

import AddEmailCard from '../surfaces/zone/AddEmailCard'
jest.mock('@/components/Home/HomeCarouselCTA/CarouselCTA', () => ({
    __esModule: true,
    default: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>Add email card</button>,
}))
test('healthy profile email entry must not claim account setup failed', () => {
    renderSurface(AddEmailCard, props('add-email'))
    fireEvent.click(screen.getByText('Add email card'))
    expect(screen.queryByText(en.kyc.provideEmail.description)).not.toBeInTheDocument()
})
test('email sheet Not now must snooze rather than permanently dismiss', () => {
    const p = props('add-email')
    renderSurface(AddEmailCard, p)
    fireEvent.click(screen.getByText('Add email card'))
    fireEvent.click(screen.getByText(en.kyc.provideEmail.notNow))
    expect(p.onSnoozed).toHaveBeenCalled()
    expect(p.onDismissed).not.toHaveBeenCalled()
})

function openEmail(p = props('add-email')) {
    renderSurface(AddEmailCard, p)
    fireEvent.click(screen.getByText('Add email card'))
    return p
}
test('invalid email cannot submit or settle the ask', async () => {
    const p = openEmail()
    fireEvent.change(screen.getByLabelText(en.kyc.provideEmail.emailLabel), { target: { value: 'bad-email' } })
    await act(async () => {
        fireEvent.click(screen.getByText(en.kyc.provideEmail.save))
    })
    expect(mockUpdateUserById).not.toHaveBeenCalled()
    expect(p.onActed).not.toHaveBeenCalled()
    expect(screen.getByText(en.kyc.provideEmail.invalidEmail)).toBeInTheDocument()
})
test('failed save remains retryable and does not settle', async () => {
    mockUpdateUserById.mockRejectedValueOnce(new Error('offline'))
    const p = openEmail()
    fireEvent.change(screen.getByLabelText(en.kyc.provideEmail.emailLabel), {
        target: { value: 'test@example.invalid' },
    })
    await act(async () => {
        fireEvent.click(screen.getByText(en.kyc.provideEmail.save))
    })
    expect(screen.getByText(en.kyc.provideEmail.saveFailed)).toBeInTheDocument()
    expect(p.onActed).not.toHaveBeenCalled()
    await act(async () => {
        fireEvent.click(screen.getByText(en.kyc.provideEmail.save))
    })
    expect(mockUpdateUserById).toHaveBeenCalledTimes(2)
    expect(mockFetchUser).toHaveBeenCalledTimes(1)
    expect(p.onActed).toHaveBeenCalledTimes(1)
})
test('pending save cannot be duplicated or closed and completes after confirmed refresh', async () => {
    let finish!: (result: object) => void
    mockUpdateUserById.mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve
        })
    )
    const p = openEmail()
    fireEvent.change(screen.getByLabelText(en.kyc.provideEmail.emailLabel), {
        target: { value: 'test@example.invalid' },
    })
    await act(async () => {
        fireEvent.click(screen.getByText(en.kyc.provideEmail.save))
    })
    expect(mockUpdateUserById).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('modal-close'))
    fireEvent.click(screen.getByText(en.kyc.provideEmail.notNow))
    expect(p.onSnoozed).not.toHaveBeenCalled()
    expect(p.onActed).not.toHaveBeenCalled()
    await act(async () => {
        finish({})
    })
    expect(p.onActed).toHaveBeenCalledTimes(1)
})
