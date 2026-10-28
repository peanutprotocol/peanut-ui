/**
 * Phase 2 surfaces' props contract: each prompt is render-only. It shows the
 * moment the manager mounts it, and reports the user's answer through
 * `onActed` / `onDismissed` / `onSnoozed` instead of deciding anything itself.
 */
import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import { REFERRAL_SOURCES } from '@/constants/analytics.consts'
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

import ReConsentModal from '@/components/Global/ReConsentModal'
import { PostSignupActionManager } from '@/components/Global/PostSignupActionManager'
import EarlyUserDrawer from '@/components/Global/EarlyUserDrawer'
import EnableAutoBalanceBanner from '@/components/Home/EnableAutoBalanceBanner'

/** Props are checked at runtime per test, so one surface's mismatch never hides another's result. */
type Surface = React.ComponentType<Record<string, unknown>>
const asSurface = (component: unknown) => component as Surface

function loadHomePushPrompt(): Surface {
    const mod = require('@/features/attention/surfaces/HomePushPrompt')
    return asSurface(mod.HomePushPrompt ?? mod.default)
}

const DAY_MS = 24 * 60 * 60 * 1000

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

const legacyModalEvents = () =>
    mockCapture.mock.calls
        .map(([event]) => event)
        .filter((event) => ['modal_shown', 'modal_dismissed', 'modal_cta_clicked'].includes(event))

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

describe('ReConsentModal', () => {
    const documents = [{ slug: 'terms' as const, currentVersion: '2026-10-01' }]
    const t = en.global.reConsent
    const renderModal = (p = props('legal-reconsent')) => {
        renderSurface(ReConsentModal, { ...p, documents })
        return p
    }

    test('renders visible immediately and never gates itself on the status endpoint', async () => {
        renderModal()
        // "Each receives AskSurfaceProps and renders visible immediately when mounted"
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(screen.getByText(t.title)).toBeInTheDocument()
        await act(async () => {})
        // "Each existing component ... loses every 'should I show?' rule"
        expect(mockGetStatus).not.toHaveBeenCalled()
    })

    test('Accept is disabled until the box is ticked, then records exactly the shown documents and reports acted', async () => {
        const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
        const p = renderModal()
        // "Accept is disabled until the checkbox is ticked"
        expect(screen.getByText(t.acceptCta)).toBeDisabled()

        fireEvent.click(screen.getByTestId('consent-checkbox'))
        await act(async () => {
            fireEvent.click(screen.getByText(t.acceptCta))
        })

        // "consentApi.accept(documents.map(acceptedLegalDocument))"
        expect(mockAccept).toHaveBeenCalledTimes(1)
        expect(mockAccept).toHaveBeenCalledWith([expect.objectContaining({ slug: 'terms' })])
        // "on success invalidate the consent query and call onActed"
        expect(invalidate).toHaveBeenCalledWith(
            expect.objectContaining({ queryKey: expect.arrayContaining(['consent-status']) })
        )
        expect(p.onActed).toHaveBeenCalledTimes(1)
        expect(mockAccept.mock.invocationCallOrder[0]).toBeLessThan(p.onActed.mock.invocationCallOrder[0])
        expect(p.onDismissed).not.toHaveBeenCalled()
        expect(p.onSnoozed).not.toHaveBeenCalled()
        // "Components stop emitting modal_shown / modal_dismissed / modal_cta_clicked themselves"
        expect(legacyModalEvents()).toEqual([])
    })

    test('a failed accept shows the save error, stays open, does not report acted, and a retry works', async () => {
        mockAccept.mockRejectedValueOnce(new Error('500'))
        const p = renderModal()
        fireEvent.click(screen.getByTestId('consent-checkbox'))
        await act(async () => {
            fireEvent.click(screen.getByText(t.acceptCta))
        })

        // "On failure show reConsent.saveError, stay open, onActed NOT called, retry possible"
        expect(screen.getByText(t.saveError)).toBeInTheDocument()
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(p.onActed).not.toHaveBeenCalled()
        expect(screen.getByText(t.acceptCta)).not.toBeDisabled()

        await act(async () => {
            fireEvent.click(screen.getByText(t.acceptCta))
        })
        expect(mockAccept).toHaveBeenCalledTimes(2)
        expect(p.onActed).toHaveBeenCalledTimes(1)
        expect(p.onDismissed).not.toHaveBeenCalled()
    })

    test.each([
        { path: 'Not now', button: t.notNow },
        { path: 'close', button: 'modal-close' },
    ])('$path snoozes to the effective date and never records consent', async ({ button }) => {
        const p = renderModal()
        const before = Date.now()
        await act(async () => {
            fireEvent.click(screen.getByText(button))
        })

        // "'Not now' / close / Escape → onSnoozed(nextPromptAt(...))", floored at MIN_SNOOZE_DAYS (7)
        expect(p.onSnoozed).toHaveBeenCalledTimes(1)
        const until = p.onSnoozed.mock.calls[0][0]
        expect(typeof until).toBe('number')
        expect(until).toBeGreaterThanOrEqual(before + 7 * DAY_MS)
        // "consentApi.accept is never called (declining is not consent)"
        expect(mockAccept).not.toHaveBeenCalled()
        // "Dismissed: never (no X-dismiss path ...)"
        expect(p.onDismissed).not.toHaveBeenCalled()
        expect(p.onActed).not.toHaveBeenCalled()
        expect(mockGetStatus).not.toHaveBeenCalled()
        expect(legacyModalEvents()).toEqual([])
    })
})

describe('HomePushPrompt', () => {
    const t = en.notifications

    test('Enable requests permission, then finishes the attempt, then reports acted', async () => {
        const p = props('push-home-fallback')
        renderSurface(loadHomePushPrompt(), p)
        // "renders visible immediately when mounted"
        expect(screen.getByTestId('modal')).toBeInTheDocument()

        await act(async () => {
            fireEvent.click(screen.getByText(t.enable))
        })

        // "Enable → requestPermission() then afterPermissionAttempt() then onActed()"
        expect(mockRequestPermission).toHaveBeenCalledTimes(1)
        expect(mockAfterPermissionAttempt).toHaveBeenCalledTimes(1)
        expect(p.onActed).toHaveBeenCalledTimes(1)
        expect(mockRequestPermission.mock.invocationCallOrder[0]).toBeLessThan(
            mockAfterPermissionAttempt.mock.invocationCallOrder[0]
        )
        expect(mockAfterPermissionAttempt.mock.invocationCallOrder[0]).toBeLessThan(
            p.onActed.mock.invocationCallOrder[0]
        )
        expect(p.onSnoozed).not.toHaveBeenCalled()
        expect(legacyModalEvents()).toEqual([])
    })

    test('Not now snoozes with the policy default (no argument)', async () => {
        const p = props('push-home-fallback')
        renderSurface(loadHomePushPrompt(), p)
        await act(async () => {
            fireEvent.click(screen.getByText(t.notNow))
        })
        // "'Not now' → onSnoozed() (policy 14 days)"
        expect(p.onSnoozed).toHaveBeenCalledTimes(1)
        expect(p.onSnoozed).toHaveBeenCalledWith()
        expect(mockRequestPermission).not.toHaveBeenCalled()
        expect(p.onActed).not.toHaveBeenCalled()
    })
})

describe('PostSignupActionManager', () => {
    const redirect = { destination: '/claim/abc', origin: 'deep-link' as const, generationId: 'generation-a' }

    beforeEach(() => {
        mockGetStoredRedirect.mockReturnValue(redirect)
    })

    test('the CTA navigates to the stored destination, clears it, and reports acted', async () => {
        const p = props('post-verification-action')
        renderSurface(PostSignupActionManager, p)
        await act(async () => {})
        // "CTA → router.push(destination), clearRedirectUrl, onActed()"
        await act(async () => {
            fireEvent.click(screen.getByText('Claim to bank'))
        })
        expect(mockRouterPush).toHaveBeenCalledWith('/claim/abc')
        expect(mockClearRedirectUrl).toHaveBeenCalledWith(redirect)
        expect(p.onActed).toHaveBeenCalledTimes(1)
        expect(p.onDismissed).not.toHaveBeenCalled()
    })

    test('closing clears the stored redirect and reports dismissed', async () => {
        const p = props('post-verification-action')
        renderSurface(PostSignupActionManager, p)
        await act(async () => {})
        // "close → clearRedirectUrl, onDismissed()"
        await act(async () => {
            fireEvent.click(screen.getByText('modal-close'))
        })
        expect(mockClearRedirectUrl).toHaveBeenCalledWith(redirect)
        expect(p.onDismissed).toHaveBeenCalledTimes(1)
        expect(p.onActed).not.toHaveBeenCalled()
        expect(mockRouterPush).not.toHaveBeenCalled()
    })
})

describe('EarlyUserDrawer', () => {
    const title = en.global.earlyUserModal.title

    test('renders open on mount with no gating inputs (no legal gate, no overlay registry, no eligibility flag)', async () => {
        mockUser = { user: { userId: 'alice', username: 'alice' } }
        renderSurface(EarlyUserDrawer, props('early-user'))
        // "EarlyUserDrawer drops its guards and useOtherOpenOverlays"; "renders visible immediately when mounted"
        expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument()
        expect(mockUpdateUserById).not.toHaveBeenCalled()
        // the share button emits a tagged invite link (TASK-23382)
        expect(mockGenerateInviteCodeLink).toHaveBeenCalledWith(
            'alice',
            REFERRAL_SOURCES.EARLY_USER_DRAWER,
            expect.any(String)
        )
    })

    test('closing saves the server flag, refreshes the user, then reports acted', async () => {
        const p = props('early-user')
        renderSurface(EarlyUserDrawer, p)
        await screen.findByRole('dialog', { name: title })
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

        // "close → updateUserById({ userId, hasSeenEarlyUserModal: true }), fetchUser(), onActed()"
        await waitFor(() => expect(p.onActed).toHaveBeenCalledTimes(1))
        expect(mockUpdateUserById).toHaveBeenCalledWith({ userId: 'alice', hasSeenEarlyUserModal: true })
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        expect(mockUpdateUserById.mock.invocationCallOrder[0]).toBeLessThan(mockFetchUser.mock.invocationCallOrder[0])
        expect(mockFetchUser.mock.invocationCallOrder[0]).toBeLessThan(p.onActed.mock.invocationCallOrder[0])
        expect(p.onDismissed).not.toHaveBeenCalled()
        expect(legacyModalEvents()).toEqual([])
    })

    test('a failed server update still settles locally and reports to Sentry', async () => {
        const failure = new Error('users endpoint down')
        mockUpdateUserById.mockRejectedValueOnce(failure)
        const p = props('early-user')
        renderSurface(EarlyUserDrawer, p)
        await screen.findByRole('dialog', { name: title })
        fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })

        // "if the server update rejects, still onActed() and Sentry"
        await waitFor(() => expect(p.onActed).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(mockCaptureException).toHaveBeenCalled())
        expect(mockCaptureException.mock.calls[0][0]).toBe(failure)
    })
})

describe('EnableAutoBalanceBanner', () => {
    test('after a failed grant, "Skip for now" snoozes for one day', async () => {
        mockGrant.mockImplementation(async () => {
            mockLastError = { kind: 'unexpected', message: 'boom' }
            return { ok: false }
        })
        const p = props('finish-card-setup')
        renderSurface(EnableAutoBalanceBanner, p)
        // "'Skip for now' (only offered after a failed or stuck grant)"
        expect(screen.queryByText(en.common.skipForNow)).not.toBeInTheDocument()

        await act(async () => {
            fireEvent.click(screen.getByText(en.common.continue))
        })
        const before = Date.now()
        await act(async () => {
            fireEvent.click(screen.getByText(en.common.skipForNow))
        })

        // "'Skip for now' → onSnoozed(now + 1 day)"
        expect(p.onSnoozed).toHaveBeenCalledTimes(1)
        const until = p.onSnoozed.mock.calls[0][0]
        expect(typeof until).toBe('number')
        expect(Math.abs(until - (before + DAY_MS))).toBeLessThanOrEqual(60_000)
        expect(p.onActed).not.toHaveBeenCalled()
    })

    test('a grant that reports ok reports acted', async () => {
        mockGrant.mockResolvedValue({ ok: true, overviewFresh: true })
        const p = props('finish-card-setup')
        renderSurface(EnableAutoBalanceBanner, p)
        await act(async () => {
            fireEvent.click(screen.getByText(en.common.continue))
        })
        // "onActed() is also called after a grant reports ok"
        await waitFor(() => expect(p.onActed).toHaveBeenCalledTimes(1))
        expect(p.onSnoozed).not.toHaveBeenCalled()
    })
})
