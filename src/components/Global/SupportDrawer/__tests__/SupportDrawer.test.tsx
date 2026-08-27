/**
 * SupportDrawer — Crisp session isolation gate.
 *
 * The bug this guards against: a logged-in user briefly seeing a *different*
 * Peanut user's chat history. The Crisp token is derived asynchronously from
 * the userId (SHA-256), so for one render it is undefined. If we open Crisp in
 * that window with no token, it falls back to the shared/device-local anonymous
 * session — which, where more than one account has been used, is the previous
 * user's conversation.
 *
 * The gate (`isAwaitingToken`) covers both surfaces:
 *  - web: the crisp-proxy iframe must not mount until the token resolves.
 *  - native (Capacitor): openMessenger() must not fire until the token resolves.
 * Anonymous visitors (no userId, no token by design) proceed immediately.
 */
import React from 'react'
import { render as rtlRender, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import SupportDrawer from '../index'
import { isCapacitor } from '@/utils/capacitor'
import { SUPPORT_EMAIL } from '@/constants/crisp'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

const mockUseCrispUserData = jest.fn()
const mockUseCrispTokenId = jest.fn()
const mockIsCapacitor = isCapacitor as jest.Mock

const nativeCrisp = {
    configure: jest.fn(),
    setUser: jest.fn(),
    setTokenID: jest.fn(),
    setString: jest.fn(),
    setSegment: jest.fn(),
    sendMessage: jest.fn(),
    openMessenger: jest.fn(),
}

const modalsState: { supportPrefilledMessage: string | undefined; isSupportModalOpen: boolean } = {
    supportPrefilledMessage: undefined,
    isSupportModalOpen: true,
}
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({
        isSupportModalOpen: modalsState.isSupportModalOpen,
        setIsSupportModalOpen: jest.fn(),
        supportPrefilledMessage: modalsState.supportPrefilledMessage,
    }),
}))
// Opening the drawer clears the support unread badge. That call is not what
// this file guards, and serverFetch reaches for Capacitor Preferences, which
// jsdom has no shim for.
const mockMarkAllRead = jest.fn(async (_category: string) => ({ ok: true }))
jest.mock('@/services/notifications', () => ({
    notificationsApi: {
        markAllRead: (category: string) => mockMarkAllRead(category),
    },
}))
jest.mock('@/hooks/useCrispUserData', () => ({
    useCrispUserData: () => mockUseCrispUserData(),
}))
jest.mock('@/hooks/useCrispTokenId', () => ({
    useCrispTokenId: () => mockUseCrispTokenId(),
}))
jest.mock('../../PeanutLoading', () => ({
    __esModule: true,
    default: () => <div data-testid="peanut-loading" />,
}))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn() }))
jest.mock('@capgo/capacitor-crisp', () => ({ CapacitorCrisp: nativeCrisp }))

const supportIframe = () => screen.queryByTitle('Support Chat')

const postCrispMessage = (type: 'CRISP_READY' | 'CRISP_FAILED') => {
    act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: { type }, origin: window.location.origin }))
    })
}

describe('SupportDrawer Crisp session gate — web iframe', () => {
    beforeEach(() => {
        mockUseCrispUserData.mockReset()
        mockUseCrispTokenId.mockReset()
        mockIsCapacitor.mockReset().mockReturnValue(false)
    })

    it('does NOT mount the proxy iframe while a logged-in user’s token is still resolving', () => {
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })
        mockUseCrispTokenId.mockReturnValue(undefined)

        render(<SupportDrawer />)

        expect(supportIframe()).not.toBeInTheDocument()
        expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
    })

    it('mounts a clean-URL iframe once the logged-in user’s token resolves', () => {
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })
        mockUseCrispTokenId.mockReturnValue('token-abc')

        render(<SupportDrawer />)

        const iframe = supportIframe()
        expect(iframe).toBeInTheDocument()
        // postmortem F5: nothing user-identifying (nor the bearer token) in the URL
        expect(iframe).toHaveAttribute('src', '/crisp-proxy')
    })

    it('mounts the anonymous proxy immediately for a logged-out visitor (no userId, no token)', () => {
        mockUseCrispUserData.mockReturnValue({ userId: undefined, email: undefined })
        mockUseCrispTokenId.mockReturnValue(undefined)

        render(<SupportDrawer />)

        const iframe = supportIframe()
        expect(iframe).toBeInTheDocument()
        expect(iframe).toHaveAttribute('src', '/crisp-proxy')
    })
})

describe('SupportDrawer — crisp-proxy init handshake (postmortem F5: no PII in URLs)', () => {
    beforeEach(() => {
        mockUseCrispUserData.mockReset().mockReturnValue({
            userId: 'user-abc',
            username: 'peanut-user',
            email: 'a@b.com',
            fullName: 'Ada Lovelace',
            walletAddressLink: 'https://arbiscan.io/address/0xabc',
        })
        mockUseCrispTokenId.mockReset().mockReturnValue('token-abc')
        mockIsCapacitor.mockReset().mockReturnValue(false)
    })

    // sends a request "from" the given window; the real proxy iframe's
    // contentWindow is the only sender the drawer may answer
    const requestInit = (origin: string, source: object) => {
        const event = new MessageEvent('message', {
            data: { type: 'CRISP_PROXY_REQUEST_INIT' },
            origin,
        })
        // MessageEvent's init rejects a non-Window `source`; define it directly instead
        Object.defineProperty(event, 'source', { value: source })
        act(() => {
            window.dispatchEvent(event)
        })
    }

    const mountedProxyWindow = () => {
        const proxyWindow = (supportIframe() as HTMLIFrameElement).contentWindow as Window
        return { proxyWindow, postSpy: jest.spyOn(proxyWindow, 'postMessage') }
    }

    it('replies to CRISP_PROXY_REQUEST_INIT with the payload, addressed to the asking iframe', () => {
        render(<SupportDrawer />)
        const { proxyWindow, postSpy } = mountedProxyWindow()

        requestInit(window.location.origin, proxyWindow)

        expect(postSpy).toHaveBeenCalledWith(
            {
                type: 'CRISP_PROXY_INIT',
                payload: expect.objectContaining({
                    tokenId: 'token-abc',
                    userData: expect.objectContaining({
                        userId: 'user-abc',
                        username: 'peanut-user',
                        email: 'a@b.com',
                        fullName: 'Ada Lovelace',
                        walletAddressLink: 'https://arbiscan.io/address/0xabc',
                    }),
                }),
            },
            window.location.origin
        )
    })

    it('ignores init requests from a foreign origin', () => {
        render(<SupportDrawer />)
        const { proxyWindow, postSpy } = mountedProxyWindow()

        requestInit('https://evil.example', proxyWindow)

        expect(postSpy).not.toHaveBeenCalled()
    })

    it('ignores same-origin init requests from a window that is not the mounted proxy iframe', () => {
        render(<SupportDrawer />)
        const stranger = { postMessage: jest.fn() }

        requestInit(window.location.origin, stranger)

        expect(stranger.postMessage).not.toHaveBeenCalled()
    })
})

describe('SupportDrawer — support unread badge', () => {
    // Opening the drawer is not the same as reading the reply: the chat has to
    // actually render. Clearing too eagerly buries a reply nobody saw.
    beforeEach(() => {
        mockUseCrispUserData.mockReset().mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })
        mockUseCrispTokenId.mockReset().mockReturnValue('token-abc')
        mockIsCapacitor.mockReset().mockReturnValue(false)
        mockMarkAllRead.mockClear()
    })

    it('clears the badge and tells the rest of the app once the chat renders', async () => {
        const onUpdated = jest.fn()
        window.addEventListener('notifications:updated', onUpdated)

        render(<SupportDrawer />)
        expect(mockMarkAllRead).not.toHaveBeenCalled()

        postCrispMessage('CRISP_READY')

        await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalledWith('support'))
        await waitFor(() => expect(onUpdated).toHaveBeenCalled())

        window.removeEventListener('notifications:updated', onUpdated)
    })

    it('does NOT clear the badge when Crisp fails and the user only sees the email fallback', async () => {
        render(<SupportDrawer />)
        postCrispMessage('CRISP_FAILED')

        await waitFor(() => expect(screen.getByText(SUPPORT_EMAIL)).toBeInTheDocument())
        expect(mockMarkAllRead).not.toHaveBeenCalled()
    })

    it('does not clear the badge for a logged-out visitor', async () => {
        mockUseCrispUserData.mockReturnValue({ userId: undefined, email: undefined })
        mockUseCrispTokenId.mockReturnValue(undefined)

        render(<SupportDrawer />)
        postCrispMessage('CRISP_READY')

        await waitFor(() => expect(supportIframe()).toBeInTheDocument())
        expect(mockMarkAllRead).not.toHaveBeenCalled()
    })
})

describe('SupportDrawer — Crisp load-failure fallback', () => {
    beforeEach(() => {
        mockUseCrispUserData.mockReset().mockReturnValue({ userId: undefined, email: undefined })
        mockUseCrispTokenId.mockReset().mockReturnValue(undefined)
        mockIsCapacitor.mockReset().mockReturnValue(false)
    })

    it('shows the mailto fallback + retry when the proxy reports CRISP_FAILED', () => {
        render(<SupportDrawer />)

        // spinner up, no fallback yet
        expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
        expect(screen.queryByText(/chat couldn't load/i)).not.toBeInTheDocument()

        postCrispMessage('CRISP_FAILED')

        // spinner replaced by a fallback with a mailto link to the real support inbox
        expect(screen.queryByTestId('peanut-loading')).not.toBeInTheDocument()
        expect(screen.getByText(/chat couldn't load/i)).toBeInTheDocument()
        const mailto = screen.getByRole('link', { name: SUPPORT_EMAIL })
        expect(mailto).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`)
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('clears the fallback and re-shows the loader when Retry is pressed', () => {
        render(<SupportDrawer />)
        postCrispMessage('CRISP_FAILED')

        fireEvent.click(screen.getByRole('button', { name: /try again/i }))

        expect(screen.queryByText(/chat couldn't load/i)).not.toBeInTheDocument()
        expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
    })

    it('a later CRISP_READY dismisses the fallback', () => {
        render(<SupportDrawer />)
        postCrispMessage('CRISP_FAILED')
        expect(screen.getByText(/chat couldn't load/i)).toBeInTheDocument()

        postCrispMessage('CRISP_READY')

        expect(screen.queryByText(/chat couldn't load/i)).not.toBeInTheDocument()
        expect(screen.queryByTestId('peanut-loading')).not.toBeInTheDocument()
    })
})

describe('SupportDrawer — pointer-events when opened inside a vaul drawer', () => {
    beforeEach(() => {
        mockUseCrispUserData.mockReset().mockReturnValue({ userId: undefined, email: undefined })
        mockUseCrispTokenId.mockReset().mockReturnValue(undefined)
        mockIsCapacitor.mockReset().mockReturnValue(false)
    })

    it('backdrop and panel explicitly re-enable pointer events while open', () => {
        // vaul sets pointer-events:none on <body> while the transaction drawer is
        // open. Without an explicit pointer-events-auto, the support overlay
        // inherits none and becomes click-transparent — taps fall through to the
        // receipt underneath (one landed on "Cancel deposit" and cancelled a
        // user's funded bank deposit).
        const { container } = render(<SupportDrawer />)

        const backdrop = container.querySelector('[aria-hidden="true"]')
        const panel = screen.getByRole('dialog', { name: 'Support' })

        expect(backdrop?.className).toContain('pointer-events-auto')
        expect(panel.className).toContain('pointer-events-auto')
        expect(backdrop?.className).not.toContain('pointer-events-none')
        expect(panel.className).not.toContain('pointer-events-none')
    })
})

describe('SupportDrawer — iOS keyboard', () => {
    // iOS leaves the layout viewport at full height when the keyboard opens, so a
    // `bottom: 0` panel keeps Crisp's composer underneath the keys. The drawer has to
    // lift by, and shrink to, whatever the visual viewport says is still on screen.
    const LAYOUT_HEIGHT = 800

    class FakeVisualViewport extends EventTarget {
        height = LAYOUT_HEIGHT
        offsetTop = 0
        scale = 1
    }

    let viewport: FakeVisualViewport
    let realInnerHeight: PropertyDescriptor | undefined

    beforeEach(() => {
        mockUseCrispUserData.mockReset().mockReturnValue({ userId: undefined, email: undefined })
        mockUseCrispTokenId.mockReset().mockReturnValue(undefined)
        mockIsCapacitor.mockReset().mockReturnValue(false)

        realInnerHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')
        viewport = new FakeVisualViewport()
        Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true })
        Object.defineProperty(window, 'innerHeight', { value: LAYOUT_HEIGHT, configurable: true })
    })

    // Hand the window back untouched — later describes in this file share it.
    afterEach(() => {
        delete (window as { visualViewport?: unknown }).visualViewport
        if (realInnerHeight) Object.defineProperty(window, 'innerHeight', realInnerHeight)
    })

    const openKeyboard = (visibleHeight: number) => {
        viewport.height = visibleHeight
        act(() => {
            viewport.dispatchEvent(new Event('resize'))
        })
    }

    // Only `bottom` is assertable here: jsdom's CSS parser drops both `env()` and
    // `min()`, so the safe-area padding and the height clamp read back as ''.
    it('sits flush on the bottom edge while no keyboard is up', () => {
        render(<SupportDrawer />)

        expect(screen.getByRole('dialog', { name: 'Support' }).style.bottom).toBe('0px')
    })

    it('lifts by exactly the height the keyboard covers', () => {
        render(<SupportDrawer />)
        const panel = screen.getByRole('dialog', { name: 'Support' })

        openKeyboard(460)

        expect(panel.style.bottom).toBe('340px')
    })
})

describe('SupportDrawer Crisp session gate — native (Capacitor)', () => {
    beforeEach(() => {
        mockUseCrispUserData.mockReset()
        mockUseCrispTokenId.mockReset()
        mockIsCapacitor.mockReset().mockReturnValue(true)
        Object.values(nativeCrisp).forEach((fn) => fn.mockReset())
    })

    it('does NOT open the native messenger while a logged-in user’s token is still resolving', async () => {
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })
        mockUseCrispTokenId.mockReturnValue(undefined)

        await act(async () => {
            render(<SupportDrawer />)
        })

        expect(nativeCrisp.openMessenger).not.toHaveBeenCalled()
    })

    it('opens the native messenger with the token bound once it resolves', async () => {
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })
        mockUseCrispTokenId.mockReturnValue('token-abc')

        await act(async () => {
            render(<SupportDrawer />)
        })

        await waitFor(() => expect(nativeCrisp.openMessenger).toHaveBeenCalled())
        expect(nativeCrisp.setTokenID).toHaveBeenCalledWith({ tokenID: 'token-abc' })
    })

    it('opens the native messenger immediately for a logged-out visitor (no token bound)', async () => {
        mockUseCrispUserData.mockReturnValue({ userId: undefined, email: undefined })
        mockUseCrispTokenId.mockReturnValue(undefined)

        await act(async () => {
            render(<SupportDrawer />)
        })

        await waitFor(() => expect(nativeCrisp.openMessenger).toHaveBeenCalled())
        expect(nativeCrisp.setTokenID).not.toHaveBeenCalled()
    })
})

/*
 * The support snapshot is live state — a balance landing from the cache, or the
 * route latch firing on open, changes `userData`'s identity. `userData` is a
 * dependency of the native open effect, so a change while the effect's async
 * chain is still awaiting camera permission used to start a SECOND chain, and
 * the user's prefilled message reached the agent twice.
 */
describe('SupportDrawer — native open runs once per open cycle', () => {
    beforeEach(() => {
        mockUseCrispUserData.mockReset()
        mockUseCrispTokenId.mockReset()
        mockIsCapacitor.mockReset().mockReturnValue(true)
        Object.values(nativeCrisp).forEach((fn) => fn.mockReset())
        modalsState.supportPrefilledMessage = undefined
        modalsState.isSupportModalOpen = true
    })

    it('sends a prefilled message once even when the snapshot changes mid-open', async () => {
        modalsState.supportPrefilledMessage = 'my withdrawal is stuck'
        mockUseCrispTokenId.mockReturnValue('token-abc')
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com', balance: 'wallet unavailable' })

        const view = render(<SupportDrawer />)

        // A fresh snapshot object lands while the open chain is still awaiting.
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com', balance: '$100.00 spendable' })
        await act(async () => {
            view.rerender(<SupportDrawer />)
        })

        await waitFor(() => expect(nativeCrisp.openMessenger).toHaveBeenCalled())
        expect(nativeCrisp.openMessenger).toHaveBeenCalledTimes(1)
        expect(
            nativeCrisp.setString.mock.calls.filter(([{ key }]: [{ key: string }]) => key === 'support_topic')
        ).toHaveLength(1)
    })

    /*
     * `sendMessage` is `unimplemented` in this plugin on BOTH iOS and Android.
     * Calling it prefilled nothing and left an unhandled rejection behind every
     * support open that carried a topic. The topic now rides as a data row.
     */
    it('delivers the support topic without calling the unimplemented sendMessage', async () => {
        modalsState.supportPrefilledMessage = 'my withdrawal is stuck'
        mockUseCrispTokenId.mockReturnValue('token-abc')
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })

        await act(async () => {
            render(<SupportDrawer />)
        })

        await waitFor(() => expect(nativeCrisp.openMessenger).toHaveBeenCalled())
        expect(nativeCrisp.sendMessage).not.toHaveBeenCalled()

        const written = Object.fromEntries(
            nativeCrisp.setString.mock.calls.map(([{ key, value }]: [{ key: string; value: string }]) => [key, value])
        )
        expect(written.support_topic).toBe('my withdrawal is stuck')
    })

    /*
     * The other half of the same window. Gating the chain to one run means the
     * snapshot that lands during setup gets no second chance to publish, so the
     * chain must read the payload after its awaits rather than from the effect
     * closure. Otherwise an agent opens the sidebar on a balance the user no
     * longer has — and routes on a `balance-unavailable` segment they left.
     */
    it('publishes the snapshot as of open, not the one captured before setup', async () => {
        mockUseCrispTokenId.mockReturnValue('token-abc')
        mockUseCrispUserData.mockReturnValue({
            userId: 'user-abc',
            email: 'a@b.com',
            balance: 'wallet unavailable',
            segments: ['ios-native', 'balance-unavailable'],
        })

        const view = render(<SupportDrawer />)

        mockUseCrispUserData.mockReturnValue({
            userId: 'user-abc',
            email: 'a@b.com',
            balance: '$100.00 spendable',
            segments: ['ios-native', 'kyc-verified'],
        })
        await act(async () => {
            view.rerender(<SupportDrawer />)
        })

        await waitFor(() => expect(nativeCrisp.openMessenger).toHaveBeenCalled())

        const written = Object.fromEntries(
            nativeCrisp.setString.mock.calls.map(([{ key, value }]: [{ key: string; value: string }]) => [key, value])
        )
        expect(written.balance).toBe('$100.00 spendable')
        expect(written.segments).toBe('ios-native kyc-verified')

        /*
         * No native segment at all: the plugin's one-argument setSegment maps to
         * Crisp.setSessionSegment on Android, which appends — a stale `offline`
         * or `balance-unavailable` would keep routing the conversation after the
         * user left that state. The data row above carries the whole list, and
         * setString assigns, so nothing is lost.
         */
        expect(nativeCrisp.setSegment).not.toHaveBeenCalled()
    })

    it('still opens once the token resolves, rather than latching the waiting cycle shut', async () => {
        mockUseCrispTokenId.mockReturnValue(undefined)
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })

        const view = render(<SupportDrawer />)
        expect(nativeCrisp.openMessenger).not.toHaveBeenCalled()

        mockUseCrispTokenId.mockReturnValue('token-abc')
        await act(async () => {
            view.rerender(<SupportDrawer />)
        })

        await waitFor(() => expect(nativeCrisp.openMessenger).toHaveBeenCalledTimes(1))
        expect(nativeCrisp.setTokenID).toHaveBeenCalledWith({ tokenID: 'token-abc' })
    })

    /*
     * A boolean latch is not enough: the chain outlives the cycle that started
     * it. Close the drawer while it is parked on the camera-permission await
     * and reopen — a boolean has already been cleared, a second chain starts,
     * both finish, and the prefill is sent twice. The generation counter makes
     * the chain check, after its awaits, whether the cycle it belongs to is
     * still the current one.
     */
    it('does not double-send when the user closes and reopens mid-chain', async () => {
        modalsState.supportPrefilledMessage = 'my withdrawal is stuck'
        mockUseCrispTokenId.mockReturnValue('token-abc')
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })

        const view = render(<SupportDrawer />)

        modalsState.isSupportModalOpen = false
        view.rerender(<SupportDrawer />)
        modalsState.isSupportModalOpen = true
        await act(async () => {
            view.rerender(<SupportDrawer />)
        })

        await waitFor(() => expect(nativeCrisp.openMessenger).toHaveBeenCalled())
        expect(nativeCrisp.openMessenger).toHaveBeenCalledTimes(1)
        expect(
            nativeCrisp.setString.mock.calls.filter(([{ key }]: [{ key: string }]) => key === 'support_topic')
        ).toHaveLength(1)
    })

    /*
     * The same gap in its other direction: a chain started before a close must
     * not open the messenger, or post the prefill, into a conversation the user
     * has already walked away from.
     */
    it('abandons a chain whose cycle the user dismissed', async () => {
        modalsState.supportPrefilledMessage = 'my withdrawal is stuck'
        mockUseCrispTokenId.mockReturnValue('token-abc')
        mockUseCrispUserData.mockReturnValue({ userId: 'user-abc', email: 'a@b.com' })

        const view = render(<SupportDrawer />)

        modalsState.isSupportModalOpen = false
        await act(async () => {
            view.rerender(<SupportDrawer />)
        })

        expect(nativeCrisp.openMessenger).not.toHaveBeenCalled()
        expect(nativeCrisp.sendMessage).not.toHaveBeenCalled()
    })
})
