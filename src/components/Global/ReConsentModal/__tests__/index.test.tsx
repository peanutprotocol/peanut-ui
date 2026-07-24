/** @jest-environment jsdom */
/**
 * ReConsentModal — the ToS §17 blocking click-through.
 *
 * This modal gates the entire app, so the safety properties matter more than
 * the happy path: a failed status check must NEVER lock the app (fail-open),
 * a failed accept must keep the retry path alive, and an account switch must
 * not leak the previous user's consent state (a regression already caught
 * once in review).
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

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

const mockCaptureException = jest.fn()
jest.mock('@sentry/nextjs', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
}))

import ReConsentModal from '../index'

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
    mockUser = { user: { userId: 'user-1' } }
})

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
