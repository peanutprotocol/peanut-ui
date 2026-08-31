/**
 * AdditionalVerificationView — the "what to expect" screen in front of
 * Bridge's hosted verification (Persona).
 *
 * Persona serves X-Frame-Options: SAMEORIGIN and cannot be embedded, so the
 * handoff opens a real top-level page (native: the in-app browser) — and the
 * tab has to be reserved INSIDE the click, before the ~800ms start-action
 * round-trip, or Safari blocks it. The prep copy exists because Persona keeps
 * no partial progress: a user who leaves mid-check to find a document
 * restarts from step one.
 */
import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import type { NextAction } from '@/types/capabilities'
import { AdditionalVerificationView } from '../AdditionalVerificationView'

const hostedAction: NextAction = {
    key: 'bridge-hosted',
    kind: 'bridge-hosted',
    purpose: 'bridge-additional-verification',
    requirementKey: 'kyc_approval',
}

const mockFetchUser = jest.fn(() => Promise.resolve(null))
const mockStartHosted = jest.fn<Promise<{ url?: string; error?: string }>, []>()
let mockReservedTab: { location: { href: string }; close: jest.Mock; closed: boolean; opener: unknown }
const mockAssignHref = jest.fn()
let mockWindowOpen: jest.SpyInstance

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1' } }, fetchUser: mockFetchUser, logoutUser: jest.fn() }),
}))
jest.mock('@/app/actions/sumsub', () => ({
    startBridgeHostedVerification: () => mockStartHosted(),
}))
const mockOpenExternalUrl = jest.fn<Promise<void>, [string]>()
let mockIsCapacitor = false
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => mockIsCapacitor,
    isAndroidNative: () => false,
    isCapacitor: () => false,
    openExternalUrl: (url: string) => mockOpenExternalUrl(url),
}))
const mockBrowserListener = { remove: jest.fn() }
const mockBrowserAddListener = jest.fn<Promise<{ remove: jest.Mock }>, [string, () => void]>(() =>
    Promise.resolve(mockBrowserListener)
)
jest.mock(
    '@capacitor/browser',
    () => ({
        Browser: { addListener: (event: string, cb: () => void) => mockBrowserAddListener(event, cb) },
    }),
    { virtual: true }
)
const mockRouterReplace = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: mockRouterReplace, back: jest.fn() }),
}))
let mockNextActions: NextAction[] = []
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ nextActions: mockNextActions }),
}))

const startVerification = () => fireEvent.click(screen.getByRole('button', { name: /i have these, start/i }))

describe('AdditionalVerificationView', () => {
    beforeEach(() => {
        mockNextActions = [hostedAction]
        mockRouterReplace.mockReset()
        mockFetchUser.mockReset()
        mockFetchUser.mockResolvedValue(null)
        mockStartHosted.mockReset()
        mockOpenExternalUrl.mockReset()
        mockOpenExternalUrl.mockResolvedValue(undefined)
        mockIsCapacitor = false
        mockAssignHref.mockReset()
        // jsdom refuses real navigation; capture the same-tab fallback instead.
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                get href() {
                    return 'http://localhost/profile/identity-verification/additional'
                },
                set href(value: string) {
                    mockAssignHref(value)
                },
            },
        })
        mockBrowserAddListener.mockClear()
        mockBrowserAddListener.mockReturnValue(Promise.resolve(mockBrowserListener))
        mockBrowserListener.remove.mockClear()
        mockReservedTab = { location: { href: '' }, close: jest.fn(), closed: false, opener: {} }
        mockWindowOpen = jest.spyOn(window, 'open').mockReturnValue(mockReservedTab as unknown as Window)
        mockWindowOpen.mockClear()
    })

    it('states the single-session constraint and the documents BEFORE anything is fetched', () => {
        render(<AdditionalVerificationView />)

        expect(screen.getByTestId('kyc-prep-single-session')).toHaveTextContent(/start again from the first step/i)
        const checklist = screen.getByTestId('kyc-prep-checklist')
        expect(checklist).toHaveTextContent(/government id/i)
        expect(checklist).toHaveTextContent(/proof of your address/i)
        expect(mockStartHosted).not.toHaveBeenCalled()
        expect(mockWindowOpen).not.toHaveBeenCalled()
    })

    it('the warning follows the document list — it is the consequence of not having them', () => {
        render(<AdditionalVerificationView />)

        const checklist = screen.getByTestId('kyc-prep-checklist')
        const warning = screen.getByTestId('kyc-prep-single-session')
        const items = [...checklist.children]
        expect(items.indexOf(warning)).toBeGreaterThan(items.findIndex((el) => /government id/i.test(el.textContent!)))
    })

    it('reserves a tab IN the click, then navigates it — never an iframe', async () => {
        // bridge.withpersona.com sends X-Frame-Options: SAMEORIGIN — embedding
        // it rendered "refused to connect" for every user in prod. And the tab
        // must be reserved inside the user gesture: after the ~800ms
        // start-action round-trip, window.open() is popup-blocked on Safari.
        let resolveUrl: (v: { url: string }) => void = () => {}
        mockStartHosted.mockReturnValue(new Promise((r) => (resolveUrl = r)))
        render(<AdditionalVerificationView />)

        startVerification()
        // Reserved synchronously, BEFORE the URL exists.
        expect(mockWindowOpen).toHaveBeenCalledWith('', '_blank')
        expect(mockReservedTab.location.href).toBe('')

        resolveUrl({ url: 'https://bridge.withpersona.com/verify?x=1' })
        await waitFor(() => expect(mockReservedTab.location.href).toBe('https://bridge.withpersona.com/verify?x=1'))
        expect(document.querySelector('iframe')).toBeNull()
        expect(mockReservedTab.close).not.toHaveBeenCalled()
    })

    it('no usable tab (pop-up blocked / standalone PWA) falls back to same-tab navigation', async () => {
        // A post-await window.open would be blocked and its null return is
        // unobservable; same-tab navigation is never gesture-gated.
        mockWindowOpen.mockReturnValue(null)
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        render(<AdditionalVerificationView />)

        startVerification()
        await waitFor(() => expect(mockAssignHref).toHaveBeenCalledWith('https://bridge.withpersona.com/verify?x=1'))
        expect(mockOpenExternalUrl).not.toHaveBeenCalled()
    })

    it('a REJECTED start-action closes the tab and unsticks the button (transport-layer failure)', async () => {
        // The action body catches its own errors, but the server action itself
        // can reject — dropped network, or a deploy invalidating the action id.
        mockStartHosted.mockRejectedValue(new Error('Failed to find Server Action'))
        render(<AdditionalVerificationView />)

        startVerification()
        expect(await screen.findByText(/couldn't start the verification/i)).toBeInTheDocument()
        expect(mockReservedTab.close).toHaveBeenCalledTimes(1)
        // Not stranded on "Loading..." — the button is tappable again.
        expect(screen.getByRole('button', { name: /i have these, start/i })).toBeEnabled()
        expect(mockAssignHref).not.toHaveBeenCalled()
    })

    it('a tab closed mid-fetch falls back instead of silently navigating a dead window', async () => {
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        mockReservedTab.closed = true
        render(<AdditionalVerificationView />)

        startVerification()
        await waitFor(() => expect(mockAssignHref).toHaveBeenCalledWith('https://bridge.withpersona.com/verify?x=1'))
        expect(mockReservedTab.location.href).toBe('')
        expect(mockReservedTab.close).toHaveBeenCalled()
    })

    it('severs window.opener on the reserved tab (reverse tabnabbing)', () => {
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        render(<AdditionalVerificationView />)

        startVerification()
        expect(mockReservedTab.opener).toBeNull()
    })

    it('native (Capacitor) skips the tab reservation and uses the in-app browser', async () => {
        mockIsCapacitor = true
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        render(<AdditionalVerificationView />)

        startVerification()
        await waitFor(() =>
            expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://bridge.withpersona.com/verify?x=1')
        )
        expect(mockWindowOpen).not.toHaveBeenCalled()
    })

    it('native waits on the in-app browser close event, not visibilitychange', async () => {
        mockIsCapacitor = true
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        render(<AdditionalVerificationView />)

        startVerification()
        await waitFor(() =>
            expect(mockBrowserAddListener).toHaveBeenCalledWith('browserFinished', expect.any(Function))
        )

        // Android WebViews may never fire visibilitychange on resume.
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
        expect(mockFetchUser).not.toHaveBeenCalled()

        const onFinished = mockBrowserAddListener.mock.calls[0][1]
        onFinished()
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
    })

    it('closes the reserved tab when the hosted URL never arrives', async () => {
        mockStartHosted.mockResolvedValue({ error: 'Action not allowed for this user' })
        render(<AdditionalVerificationView />)

        startVerification()
        expect(await screen.findByText(/couldn't start the verification/i)).toBeInTheDocument()
        await waitFor(() => expect(mockReservedTab.close).toHaveBeenCalledTimes(1))
    })

    it('start-action failure surfaces FRIENDLY copy (never the raw server error) and resyncs the user', async () => {
        mockStartHosted.mockResolvedValue({ error: 'Action not allowed for this user' })
        render(<AdditionalVerificationView />)

        startVerification()
        expect(await screen.findByText(/couldn't start the verification/i)).toBeInTheDocument()
        expect(screen.queryByText('Action not allowed for this user')).not.toBeInTheDocument()
        expect(mockOpenExternalUrl).not.toHaveBeenCalled()
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    it('refetches the user when they come back to the app (nothing polls a requires-info rail)', async () => {
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        render(<AdditionalVerificationView />)

        startVerification()
        await waitFor(() => expect(mockReservedTab.location.href).toContain('withpersona'))
        expect(mockFetchUser).not.toHaveBeenCalled()

        // Leaving the app fires visibilitychange too — only the return refetches.
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
        expect(mockFetchUser).not.toHaveBeenCalled()

        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))

        // NOT one-shot: an incidental switch-back must not burn the refetch,
        // so a later real return refreshes again.
        document.dispatchEvent(new Event('visibilitychange'))
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(2))
    })

    it('leaves the screen once the task clears — the ONLY signal the check passed', async () => {
        // Nothing else reports success: the ~4s auto-refresh does not run for a
        // requires-info rail, so the refetch on return is what clears the task.
        // The card this replaced got the exit for free by unmounting; a route
        // has to act on it, or the user sits on a CTA whose only outcome is 403.
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        const { rerender } = render(<AdditionalVerificationView />)

        startVerification()
        await waitFor(() => expect(mockReservedTab.location.href).toContain('withpersona'))
        expect(mockRouterReplace).not.toHaveBeenCalled()

        mockNextActions = []
        rerender(<AdditionalVerificationView />)
        await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/profile/identity-verification'))
    })

    it('an empty capability read on a COLD mount does not bounce the user off the screen', () => {
        // Capabilities can read empty for a beat before the user query lands.
        // Only a return from the vendor is evidence the task is done.
        mockNextActions = []
        render(<AdditionalVerificationView />)

        expect(mockRouterReplace).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: /i have these, start/i })).toBeEnabled()
    })

    it('announces a launch failure to screen readers instead of leaving focus on a dead CTA', async () => {
        mockStartHosted.mockResolvedValue({ error: 'Action not allowed for this user' })
        render(<AdditionalVerificationView />)

        startVerification()
        // Scoped by testid, not by role: the single-session banner is an
        // `attention` Notification, which the DS also gives role="alert".
        const alert = await screen.findByTestId('hosted-start-error')
        expect(alert).toHaveAttribute('role', 'alert')
        expect(alert).toHaveTextContent(/couldn't start the verification/i)
    })

    it('a browserFinished listener resolving AFTER cleanup removes itself', async () => {
        mockIsCapacitor = true
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        // Registration still in flight when the screen goes away.
        let resolveListener: (v: { remove: jest.Mock }) => void = () => {}
        mockBrowserAddListener.mockReturnValue(new Promise((r) => (resolveListener = r)))
        const { unmount } = render(<AdditionalVerificationView />)

        startVerification()
        await waitFor(() => expect(mockBrowserAddListener).toHaveBeenCalled())
        unmount()

        resolveListener(mockBrowserListener)
        await waitFor(() => expect(mockBrowserListener.remove).toHaveBeenCalledTimes(1))
    })
})
