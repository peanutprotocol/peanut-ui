/**
 * legal re-consent outranks the migration download prompt (TASK-22452 item
 * 12). both modals render together under one real ModalsProvider, like the
 * app: ReConsentModal in the layout, MigrationDownloadModal in HomeModals.
 * the properties under test: the download prompt never flashes while the
 * consent CHECK is still in flight, defers for the rest of the visit once a
 * legal prompt was actually shown to this account, releases on a failed
 * check (fail-open) and on consent-surface unmount, and an account switch
 * re-arms the gate so one account's 'clear' can never release another.
 */
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { ModalsProvider } from '@/context/ModalsContext'

const mockGetStatus = jest.fn<Promise<unknown>, []>()
jest.mock('@/services/consent', () => ({
    consentApi: {
        getStatus: () => mockGetStatus(),
        accept: jest.fn().mockResolvedValue(undefined),
    },
    acceptedLegalDocument: (slug: string) => ({ slug, version: '2026-07-15', hash: 'a'.repeat(64) }),
}))

let mockUser: { user: { userId: string } } | null = null
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser }),
}))

// one stub serves both modals; the title tells them apart. every COMMITTED
// visible state is recorded with the account it committed under — rtl's act
// flushes intermediate renders before a queryBy assertion runs, so only this
// record can prove no modal flashed under the wrong account mid-switch.
const committedVisible: { userId: string; title?: string }[] = []
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: { visible: boolean; title?: string; onClose: () => void }) => {
        const userId = mockUser?.user.userId ?? ''
        jest.requireActual<typeof React>('react').useLayoutEffect(() => {
            if (props.visible) committedVisible.push({ userId, title: props.title })
        }, [props.visible, props.title, userId])
        if (!props.visible) return null
        return (
            <div data-testid={`modal-${props.title}`}>
                <button onClick={props.onClose}>{`dismiss-${props.title}`}</button>
            </div>
        )
    },
}))

const migrationCommitsFor = (userId: string) =>
    committedVisible.filter((entry) => entry.userId === userId && entry.title === 'downloadPrompt.earlyTitle')
jest.mock('@/components/Global/DocsLink', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))
jest.mock('@/components/Migration/DownloadQR', () => ({ __esModule: true, default: () => null }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => true }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => false,
    isIOSNative: () => false,
    isAndroidNative: () => false,
    isLegacyWebKit: () => false,
    openExternalUrl: jest.fn(),
}))
jest.mock('@/utils/migration.utils', () => ({
    // far cutover: the early (non-urgent) variant, always inside the window
    getMigrationCutoverTime: () => Date.now() + 90 * 24 * 60 * 60 * 1000,
    openStore: jest.fn(),
}))
jest.mock('@/utils/general.utils', () => ({
    ...jest.requireActual('@/utils/general.utils'),
    getUserPreferences: () => undefined,
    updateUserPreferences: jest.fn(),
}))

import ReConsentModal from '@/components/Global/ReConsentModal'
import MigrationDownloadModal from '../MigrationDownloadModal'

const statusDoc = () => ({
    slug: 'terms',
    currentVersion: '2026-07-15',
    acceptedVersion: null,
    acceptedAt: null,
    needsAcceptance: true,
})

const flush = () => act(async () => {})

// the migration stub's title key and the re-consent stub's title key
const MIGRATION_MODAL = 'modal-downloadPrompt.earlyTitle'
const RECONSENT_MODAL = 'modal-reConsent.title'

const deferred = () => {
    let resolve!: (value: unknown) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

// one stable provider across rerenders — the gate state must survive a
// consent-surface unmount, exactly like the app's root provider does
function Tree({ withConsent = true }: { withConsent?: boolean }) {
    return (
        <ModalsProvider>
            {withConsent && <ReConsentModal />}
            <MigrationDownloadModal />
        </ModalsProvider>
    )
}
const Both = Tree

beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    committedVisible.length = 0
    mockUser = { user: { userId: 'user-a' } }
})

describe('legal re-consent vs download prompt priority', () => {
    test('download prompt never renders while the consent check is in flight, and legal wins when both are eligible', async () => {
        const pending = deferred()
        mockGetStatus.mockReturnValue(pending.promise as Promise<unknown>)
        render(<Both />)

        // synchronous first render AND settled effects: still gated — and no
        // intermediate commit ever flashed the prompt on this cold login
        expect(screen.queryByTestId(MIGRATION_MODAL)).not.toBeInTheDocument()
        await flush()
        expect(screen.queryByTestId(MIGRATION_MODAL)).not.toBeInTheDocument()
        expect(migrationCommitsFor('user-a')).toEqual([])

        await act(async () => {
            pending.resolve({ needsReConsent: true, documents: [statusDoc()] })
        })
        expect(screen.getByTestId(RECONSENT_MODAL)).toBeInTheDocument()
        expect(screen.queryByTestId(MIGRATION_MODAL)).not.toBeInTheDocument()

        // dismissing legal must not pop the download prompt in the same visit
        fireEvent.click(screen.getByText('dismiss-reConsent.title'))
        await flush()
        expect(screen.queryByTestId(RECONSENT_MODAL)).not.toBeInTheDocument()
        expect(screen.queryByTestId(MIGRATION_MODAL)).not.toBeInTheDocument()
        expect(migrationCommitsFor('user-a')).toEqual([])
    })

    test('a no-change consent check releases the download prompt', async () => {
        mockGetStatus.mockResolvedValue({ needsReConsent: false, documents: [] })
        render(<Both />)
        await flush()
        expect(screen.getByTestId(MIGRATION_MODAL)).toBeInTheDocument()
    })

    test('a failed consent check fails open — the download prompt is not blocked', async () => {
        mockGetStatus.mockRejectedValue(new Error('api down'))
        render(<Both />)
        await flush()
        expect(screen.getByTestId(MIGRATION_MODAL)).toBeInTheDocument()
    })

    test('the consent surface unmounting releases the gate mid-check', async () => {
        const pending = deferred()
        mockGetStatus.mockReturnValue(pending.promise as Promise<unknown>)
        const view = render(<Both />)
        await flush()
        expect(screen.queryByTestId(MIGRATION_MODAL)).not.toBeInTheDocument()

        view.rerender(<Tree withConsent={false} />)
        await flush()
        expect(screen.getByTestId(MIGRATION_MODAL)).toBeInTheDocument()
    })

    test("an account switch re-arms the gate: A's clear never releases B before B's own check", async () => {
        mockGetStatus.mockResolvedValueOnce({ needsReConsent: false, documents: [] })
        const view = render(<Both />)
        await flush()
        expect(screen.getByTestId(MIGRATION_MODAL)).toBeInTheDocument()

        // switch to account B with its check still pending — a is VISIBLE at
        // the moment of the switch, the hardest case
        const pendingB = deferred()
        mockGetStatus.mockReturnValue(pendingB.promise as Promise<unknown>)
        mockUser = { user: { userId: 'user-b' } }
        view.rerender(<Both />)
        // no COMMIT under b, not merely no final dom: rtl flushes the
        // intermediate effect passes, so only the commit record catches a's
        // stale visible/clear leaking into b's first frames
        expect(migrationCommitsFor('user-b')).toEqual([])
        expect(screen.queryByTestId(MIGRATION_MODAL)).not.toBeInTheDocument()
        await flush()
        expect(migrationCommitsFor('user-b')).toEqual([])
        expect(screen.queryByTestId(MIGRATION_MODAL)).not.toBeInTheDocument()

        await act(async () => {
            pendingB.resolve({ needsReConsent: false, documents: [] })
        })
        expect(screen.getByTestId(MIGRATION_MODAL)).toBeInTheDocument()
        expect(migrationCommitsFor('user-b').length).toBeGreaterThan(0)
    })

    test("A->B while A's prompt is visible and B's check fails: release only on the fail-open", async () => {
        mockGetStatus.mockResolvedValueOnce({ needsReConsent: false, documents: [] })
        const view = render(<Both />)
        await flush()
        expect(screen.getByTestId(MIGRATION_MODAL)).toBeInTheDocument()

        const pendingB = deferred()
        mockGetStatus.mockReturnValue(pendingB.promise as Promise<unknown>)
        mockUser = { user: { userId: 'user-b' } }
        view.rerender(<Both />)
        await flush()
        expect(migrationCommitsFor('user-b')).toEqual([])
        expect(screen.queryByTestId(MIGRATION_MODAL)).not.toBeInTheDocument()

        await act(async () => {
            pendingB.reject(new Error('api down'))
        })
        // fail-open: b is released once ITS check settles, never before
        expect(screen.getByTestId(MIGRATION_MODAL)).toBeInTheDocument()
    })

    test('the shown-prompt deferral is per account: B is not latched by the prompt A saw', async () => {
        mockGetStatus.mockResolvedValueOnce({ needsReConsent: true, documents: [statusDoc()] })
        const view = render(<Both />)
        await flush()
        expect(screen.getByTestId(RECONSENT_MODAL)).toBeInTheDocument()
        fireEvent.click(screen.getByText('dismiss-reConsent.title'))
        await flush()
        // A stays deferred for the visit
        expect(screen.queryByTestId(MIGRATION_MODAL)).not.toBeInTheDocument()

        mockGetStatus.mockResolvedValueOnce({ needsReConsent: false, documents: [] })
        mockUser = { user: { userId: 'user-b' } }
        view.rerender(<Both />)
        await flush()
        expect(screen.getByTestId(MIGRATION_MODAL)).toBeInTheDocument()
    })
})
