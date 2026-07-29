/** @jest-environment jsdom */
/**
 * ReConsentModal — the ToS §17 click-through.
 *
 * The safety properties matter more than the happy path: a failed status check
 * must NEVER block the app (fail-open), a failed accept must keep the retry
 * path alive, an account switch must not leak the previous user's consent state
 * (a regression already caught once in review), and — because §17.2 gives a
 * 30-day runway and §17.3 requires a decliner to still reach their funds — the
 * prompt must ALWAYS be escapable and must never ledger a refusal as consent.
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

const mockGetStatus = jest.fn<Promise<unknown>, []>()
const mockAccept = jest.fn<Promise<unknown>, [unknown]>()
jest.mock('@/services/consent', () => ({
    consentApi: {
        getStatus: () => mockGetStatus(),
        accept: (docs: unknown) => mockAccept(docs),
    },
    acceptedLegalDocument: (slug: string) => ({ slug, version: '2026-07-15', hash: 'a'.repeat(64) }),
}))

let mockUser: { user: { userId: string } } | null = null
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser }),
}))

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: {
        visible: boolean
        title?: string
        content?: React.ReactNode
        checkbox?: { text: string; checked: boolean; onChange: (checked: boolean) => void }
        ctas?: { text: string; disabled?: boolean; onClick: () => void }[]
    }) => {
        const checkbox = props.checkbox
        if (!props.visible) return null
        return (
            <div data-testid="modal">
                <h3>{props.title}</h3>
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
                    <button key={c.text} disabled={c.disabled} onClick={c.onClick}>
                        {c.text}
                    </button>
                ))}
            </div>
        )
    },
}))

jest.mock('@/components/Global/DocsLink', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({ capture: (...args: unknown[]) => mockCapture(...args) }))

const mockCaptureException = jest.fn()
jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
}))

import ReConsentModal from '../index'
import { nextPromptAt, LEGAL_NOTICE_PERIOD_DAYS, MIN_SNOOZE_DAYS } from '../utils'

const DAY_MS = 24 * 60 * 60 * 1000

describe('nextPromptAt', () => {
    // 2026-07-15 + 30d = 2026-08-14, the date the current terms take effect
    const posted = '2026-07-15'
    const dayAfterPosting = Date.parse('2026-07-16')

    it('defers to the effective date — the full §17.2 notice period, not a fixed interval', () => {
        expect(nextPromptAt([posted], dayAfterPosting)).toBe(Date.parse('2026-08-14'))
    })

    it('uses the LATEST effective date when several documents are shown at once', () => {
        expect(nextPromptAt(['2026-07-01', posted], dayAfterPosting)).toBe(Date.parse('2026-08-14'))
    })

    it('floors to MIN_SNOOZE_DAYS once a document is already past its notice period', () => {
        // §17.3 already makes continued use acceptance here, so the prompt only
        // still asks to record explicit consent — it must not nag every open
        const longAfter = Date.parse('2027-01-01')
        expect(nextPromptAt([posted], longAfter)).toBe(longAfter + MIN_SNOOZE_DAYS * DAY_MS)
    })

    it('falls back to the floor rather than throwing on an unparseable version', () => {
        const now = Date.parse('2026-07-29')
        expect(nextPromptAt(['not-a-date'], now)).toBe(now + MIN_SNOOZE_DAYS * DAY_MS)
        expect(nextPromptAt([], now)).toBe(now + MIN_SNOOZE_DAYS * DAY_MS)
    })

    it('pins the notice period to the 30 days our own ToS §17.2 promises', () => {
        expect(LEGAL_NOTICE_PERIOD_DAYS).toBe(30)
    })
})

const statusDoc = (slug: string) => ({
    slug,
    currentVersion: '2026-07-15',
    acceptedVersion: null,
    acceptedAt: null,
    needsAcceptance: true,
})

const flush = () => act(async () => {})

beforeEach(() => {
    jest.clearAllMocks()
    // the snooze is persisted per-user in localStorage — a leaked entry would
    // silently suppress the prompt in every later test
    window.localStorage.clear()
    mockUser = { user: { userId: 'user-1' } }
})

const capturedEvents = () => mockCapture.mock.calls.map(([event]) => event)

describe('ReConsentModal', () => {
    it('fails open: a failed status check never shows (or locks) the modal', async () => {
        mockGetStatus.mockRejectedValue(new Error('api down'))
        render(<ReConsentModal />)
        await flush()
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        // ...but prod is told about it
        expect(mockCaptureException).toHaveBeenCalledTimes(1)
    })

    it('stays hidden when no re-consent is needed', async () => {
        mockGetStatus.mockResolvedValue({ needsReConsent: false, documents: [] })
        render(<ReConsentModal />)
        await flush()
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it('stays hidden when the only outdated docs are ones this client cannot display', async () => {
        mockGetStatus.mockResolvedValue({
            needsReConsent: true,
            documents: [statusDoc('some-future-doc-this-build-does-not-know')],
        })
        render(<ReConsentModal />)
        await flush()
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it('shows outdated docs and records acceptance of exactly what was displayed', async () => {
        mockGetStatus.mockResolvedValue({
            needsReConsent: true,
            documents: [statusDoc('terms'), statusDoc('privacy')],
        })
        mockAccept.mockResolvedValue({ recorded: 2 })
        render(<ReConsentModal />)
        await flush()

        expect(screen.getByTestId('modal')).toBeInTheDocument()
        const cta = screen.getByText('Accept & continue')
        expect(cta).toBeDisabled()

        fireEvent.click(screen.getByTestId('consent-checkbox'))
        await act(async () => {
            fireEvent.click(screen.getByText('Accept & continue'))
        })

        expect(mockAccept).toHaveBeenCalledWith([
            expect.objectContaining({ slug: 'terms' }),
            expect.objectContaining({ slug: 'privacy' }),
        ])
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        // acceptance must be distinguishable from refusal in analytics —
        // the accept-vs-postpone ratio is the rollout's headline metric
        expect(capturedEvents()).toEqual(['modal_shown', 'modal_cta_clicked'])
    })

    it('"Not now" is always available and never gated on the checkbox', async () => {
        mockGetStatus.mockResolvedValue({ needsReConsent: true, documents: [statusDoc('terms')] })
        render(<ReConsentModal />)
        await flush()

        expect(screen.getByText('Accept & continue')).toBeDisabled()
        // the escape hatch must not require ticking a consent box first
        expect(screen.getByText('Not now')).not.toBeDisabled()
    })

    it('"Not now" dismisses without recording any consent (a refusal is not a ledger row)', async () => {
        mockGetStatus.mockResolvedValue({ needsReConsent: true, documents: [statusDoc('terms')] })
        render(<ReConsentModal />)
        await flush()

        await act(async () => {
            fireEvent.click(screen.getByText('Not now'))
        })

        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockAccept).not.toHaveBeenCalled()
        expect(capturedEvents()).toEqual(['modal_shown', 'modal_dismissed'])
    })

    it('a postponed prompt stays away on the next session, then returns once the snooze lapses', async () => {
        mockGetStatus.mockResolvedValue({ needsReConsent: true, documents: [statusDoc('terms')] })
        const first = render(<ReConsentModal />)
        await flush()
        await act(async () => {
            fireEvent.click(screen.getByText('Not now'))
        })
        first.unmount()

        // fresh session (remount → fresh refs), still inside the snooze window
        render(<ReConsentModal />)
        await flush()
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        // and we don't even spend the request while snoozed
        expect(mockGetStatus).toHaveBeenCalledTimes(1)

        // snooze lapses → the prompt comes back
        window.localStorage.setItem('peanut.reconsent.snoozedUntil.user-1', String(Date.now() - 1))
        render(<ReConsentModal />)
        await flush()
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('one user postponing does not suppress the prompt for a different account', async () => {
        mockGetStatus.mockResolvedValue({ needsReConsent: true, documents: [statusDoc('terms')] })
        const first = render(<ReConsentModal />)
        await flush()
        await act(async () => {
            fireEvent.click(screen.getByText('Not now'))
        })
        first.unmount()

        mockUser = { user: { userId: 'user-2' } }
        render(<ReConsentModal />)
        await flush()
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('a failed accept keeps the modal, shows the error, and leaves retry enabled', async () => {
        mockGetStatus.mockResolvedValue({ needsReConsent: true, documents: [statusDoc('terms')] })
        mockAccept.mockRejectedValue(new Error('500'))
        render(<ReConsentModal />)
        await flush()

        fireEvent.click(screen.getByTestId('consent-checkbox'))
        await act(async () => {
            fireEvent.click(screen.getByText('Accept & continue'))
        })

        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(screen.getByText(/could not save your acceptance/i)).toBeInTheDocument()
        expect(screen.getByText('Accept & continue')).not.toBeDisabled()
        expect(mockCaptureException).toHaveBeenCalledTimes(1)
    })

    it('discards a slow status response from the previous account after a switch', async () => {
        let resolvePreviousUser: (v: unknown) => void = () => undefined
        mockGetStatus.mockImplementationOnce(() => new Promise((resolve) => (resolvePreviousUser = resolve)))
        const { rerender } = render(<ReConsentModal />)

        mockGetStatus.mockResolvedValueOnce({ needsReConsent: false, documents: [] })
        mockUser = { user: { userId: 'user-2' } }
        rerender(<ReConsentModal />)
        await flush()

        // user-1's response arrives late — it must not populate user-2's modal
        await act(async () => {
            resolvePreviousUser({ needsReConsent: true, documents: [statusDoc('terms')] })
        })
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it('re-checks (and resets state) for each distinct user, once per session', async () => {
        mockGetStatus.mockResolvedValue({ needsReConsent: false, documents: [] })
        const { rerender } = render(<ReConsentModal />)
        await flush()
        rerender(<ReConsentModal />)
        await flush()
        // same user re-rendering → still one check
        expect(mockGetStatus).toHaveBeenCalledTimes(1)

        mockUser = { user: { userId: 'user-2' } }
        rerender(<ReConsentModal />)
        await flush()
        expect(mockGetStatus).toHaveBeenCalledTimes(2)
    })
})
