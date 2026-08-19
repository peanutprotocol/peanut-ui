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
    sendMessage: jest.fn(),
    openMessenger: jest.fn(),
}

jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({
        isSupportModalOpen: true,
        setIsSupportModalOpen: jest.fn(),
        supportPrefilledMessage: undefined,
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
jest.mock('../../Loading', () => ({
    __esModule: true,
    default: (props: any) =>
        props.variant === 'mascot' ? <div data-testid="peanut-loading" /> : <div data-testid="loading-spinner" />,
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
