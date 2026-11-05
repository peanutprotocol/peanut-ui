jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * IframeWrapper message routing — the wrapper reacts ONLY to postMessages
 * from ITS OWN iframe (source identity), never to a sibling's. The previous
 * guard keyed on `visible`, which (a) let two concurrently-visible wrappers
 * fire each other's handlers (double ToS confirms + phantom flow
 * transitions) and (b) dropped a real completion that landed in the instant
 * a modal was hiding — the acceptance existed at Bridge but was never
 * confirmed in-app.
 */
import React from 'react'
import { render as rtlRender, act, fireEvent, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import IframeWrapper from '../index'

const render = (ui: React.ReactElement) => rtlRender(<IntlWrapper>{ui}</IntlWrapper>)

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
}))

let mockIsAndroidNativeBridge = false
// keep the real module (the DS mascot picker calls isAndroidNative at import
// time) and only override the bridge probe under test
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isAndroidNativeBridge: () => mockIsAndroidNativeBridge,
}))

const mockBrowserOpen = jest.fn<Promise<void>, [{ url: string }]>(() => Promise.resolve())
const mockRemoveListener = jest.fn()
let browserFinished: (() => void) | undefined
// when set, addListener does not resolve until resolveListener() is called —
// lets tests unmount while registration is still in flight
let deferListener = false
let resolveListener: (() => void) | undefined
jest.mock(
    '@capacitor/browser',
    () => ({
        Browser: {
            open: (options: { url: string }) => mockBrowserOpen(options),
            addListener: (_event: string, cb: () => void) => {
                browserFinished = cb
                const handle = { remove: mockRemoveListener }
                if (!deferListener) return Promise.resolve(handle)
                return new Promise((resolve) => {
                    resolveListener = () => resolve(handle)
                })
            },
        },
    }),
    { virtual: true }
)

beforeEach(() => {
    mockIsAndroidNativeBridge = false
    mockBrowserOpen.mockClear()
    mockRemoveListener.mockClear()
    browserFinished = undefined
    deferListener = false
    resolveListener = undefined
})

function findIframe(src: string): HTMLIFrameElement {
    // headlessui Dialog portals into document.body — search the document.
    const iframe = Array.from(document.querySelectorAll('iframe')).find((f) => f.getAttribute('src') === src)
    if (!iframe) throw new Error(`iframe with src ${src} not mounted`)
    return iframe
}

function postFrom(source: Window | null, data: unknown) {
    act(() => {
        window.dispatchEvent(new MessageEvent('message', { data, source: source as MessageEventSource | null }))
    })
}

describe('IframeWrapper message routing', () => {
    it("handles its OWN iframe's completion message", () => {
        const onClose = jest.fn()
        render(<IframeWrapper src="https://one.test/flow" visible onClose={onClose} />)

        postFrom(findIframe('https://one.test/flow').contentWindow, {
            name: 'complete',
            metadata: { status: 'completed' },
        })
        expect(onClose).toHaveBeenCalledWith('completed')
    })

    it("handles its OWN iframe's ToS message, once per frame", () => {
        const onClose = jest.fn()
        render(<IframeWrapper src="https://one.test/tos" visible onClose={onClose} />)
        const own = findIframe('https://one.test/tos').contentWindow

        postFrom(own, { signedAgreementId: 'sig-1' })
        postFrom(own, { signedAgreementId: 'sig-1' })
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onClose).toHaveBeenCalledWith('tos_accepted')
    })

    it("ignores a SIBLING iframe's message even when BOTH wrappers are visible", () => {
        const onCloseA = jest.fn()
        const onCloseB = jest.fn()
        render(
            <>
                <IframeWrapper src="https://a.test/tos" visible onClose={onCloseA} />
                <IframeWrapper src="https://b.test/hosted" visible onClose={onCloseB} />
            </>
        )

        postFrom(findIframe('https://b.test/hosted').contentWindow, { signedAgreementId: 'sig-b' })
        expect(onCloseB).toHaveBeenCalledWith('tos_accepted')
        expect(onCloseA).not.toHaveBeenCalled()
    })

    it('ignores messages with no source (nothing to attribute them to)', () => {
        const onClose = jest.fn()
        render(<IframeWrapper src="https://one.test/flow" visible onClose={onClose} />)

        postFrom(null, { name: 'complete', metadata: { status: 'completed' } })
        postFrom(null, { signedAgreementId: 'sig-x' })
        expect(onClose).not.toHaveBeenCalled()
    })
})

/**
 * Bridge's ToS page reports a signature by postMessage only when its link has
 * no redirect. With one, it moves its own frame to that address and reports
 * nothing, and in the iOS app the new address refuses to render: a blank frame
 * the user could not leave except by backing out (TASK-23881). The frame's
 * second load is the signal that the provider page is gone.
 */
describe('IframeWrapper when the page moves its own frame', () => {
    const load = (iframe: HTMLIFrameElement) => act(() => void fireEvent.load(iframe))

    it("reports 'returned' on the frame's second load, never an acceptance it did not observe", () => {
        const onClose = jest.fn()
        render(<IframeWrapper src="https://compliance.test/tos" visible onClose={onClose} />)
        const iframe = findIframe('https://compliance.test/tos')

        load(iframe)
        expect(onClose).not.toHaveBeenCalled()

        load(iframe)
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onClose).toHaveBeenCalledWith('returned')
    })

    it('reports the move once, however many documents the frame loads afterwards', () => {
        const onClose = jest.fn()
        render(<IframeWrapper src="https://compliance.test/tos" visible onClose={onClose} />)
        const iframe = findIframe('https://compliance.test/tos')

        load(iframe)
        load(iframe)
        load(iframe)
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('stays quiet about a move after the page already reported the signature', () => {
        const onClose = jest.fn()
        render(<IframeWrapper src="https://compliance.test/tos" visible onClose={onClose} />)
        const iframe = findIframe('https://compliance.test/tos')

        load(iframe)
        postFrom(iframe.contentWindow, { signedAgreementId: 'sig-1' })
        load(iframe)
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onClose).toHaveBeenCalledWith('tos_accepted')
    })

    it('ignores a signature message after the move was already reported', () => {
        const onClose = jest.fn()
        render(<IframeWrapper src="https://compliance.test/tos" visible onClose={onClose} />)
        const iframe = findIframe('https://compliance.test/tos')

        load(iframe)
        load(iframe)
        postFrom(iframe.contentWindow, { signedAgreementId: 'sig-1' })
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onClose).toHaveBeenCalledWith('returned')
    })

    it('counts loads per frame, so a new link starts over', () => {
        const onClose = jest.fn()
        const { rerender } = render(<IframeWrapper src="https://compliance.test/tos-1" visible onClose={onClose} />)
        load(findIframe('https://compliance.test/tos-1'))

        rerender(
            <IntlWrapper>
                <IframeWrapper src="https://compliance.test/tos-2" visible onClose={onClose} />
            </IntlWrapper>
        )
        load(findIframe('https://compliance.test/tos-2'))
        expect(onClose).not.toHaveBeenCalled()
    })
})

/**
 * Android's Capacitor WebView cancels third-party SUBFRAME navigations
 * (BridgeWebViewClient hands every request to launchIntent without checking
 * isForMainFrame), so the ToS iframe painted pure white and acceptance was
 * impossible in the native app. Android renders no iframe at all now — the
 * page opens in the system browser and the close event drives the flow.
 */
describe('IframeWrapper on android native', () => {
    const flush = () => act(async () => undefined)

    it('opens the system browser instead of framing the page', async () => {
        mockIsAndroidNativeBridge = true
        const onClose = jest.fn()
        render(<IframeWrapper src="https://compliance.test/tos" visible onClose={onClose} />)
        await flush()

        expect(document.querySelectorAll('iframe')).toHaveLength(0)
        expect(mockBrowserOpen).toHaveBeenCalledWith({ url: 'https://compliance.test/tos' })
    })

    it("reports the return as 'returned', never as an acceptance it did not observe", async () => {
        mockIsAndroidNativeBridge = true
        const onClose = jest.fn()
        render(<IframeWrapper src="https://compliance.test/tos" visible onClose={onClose} />)
        await flush()

        act(() => browserFinished?.())
        expect(onClose).toHaveBeenCalledWith('returned')
        expect(onClose).not.toHaveBeenCalledWith('tos_accepted')
    })

    it('does not open the browser while hidden, and drops the listener on unmount', async () => {
        mockIsAndroidNativeBridge = true
        const { rerender, unmount } = render(
            <IframeWrapper src="https://compliance.test/tos" visible={false} onClose={jest.fn()} />
        )
        await flush()
        expect(mockBrowserOpen).not.toHaveBeenCalled()

        rerender(
            <IntlWrapper>
                <IframeWrapper src="https://compliance.test/tos" visible onClose={jest.fn()} />
            </IntlWrapper>
        )
        await flush()
        expect(mockBrowserOpen).toHaveBeenCalledTimes(1)

        unmount()
        expect(mockRemoveListener).toHaveBeenCalled()
    })

    it('does not open the browser when unmounted while listener registration is in flight', async () => {
        mockIsAndroidNativeBridge = true
        deferListener = true
        const { unmount } = render(<IframeWrapper src="https://compliance.test/tos" visible onClose={jest.fn()} />)
        await flush()

        unmount()
        resolveListener?.()
        await flush()

        expect(mockBrowserOpen).not.toHaveBeenCalled()
        expect(mockRemoveListener).toHaveBeenCalled()
    })

    it('still frames the page on every other platform', async () => {
        render(<IframeWrapper src="https://compliance.test/tos" visible onClose={jest.fn()} />)
        await flush()

        expect(findIframe('https://compliance.test/tos')).toBeTruthy()
        expect(mockBrowserOpen).not.toHaveBeenCalled()
    })
})

/**
 * The close controls match SumsubWebSdkModal: a header row with support on the
 * left and an X on the right. Neither closes the flow directly; each opens its
 * confirmation modal first.
 */
describe('IframeWrapper header controls', () => {
    it('opens the stop-verification modal from the X without closing the flow', () => {
        const onClose = jest.fn()
        render(<IframeWrapper src="https://one.test/flow" visible onClose={onClose} />)

        // the outer Modal keeps its own close button, hidden by class
        const headerClose = screen
            .getAllByRole('button', { name: en.common.close })
            .find((button) => !button.classList.contains('hidden'))
        fireEvent.click(headerClose!)
        expect(screen.getByText(en.global.iframeWrapper.exitTitle)).toBeInTheDocument()
        expect(onClose).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: en.global.iframeWrapper.exit }))
        expect(onClose).toHaveBeenCalledWith('manual')
    })

    it('opens the trouble modal from the support button', () => {
        render(<IframeWrapper src="https://one.test/flow" visible onClose={jest.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: en.common.contactSupport }))
        expect(screen.getByText(en.global.iframeWrapper.troubleTitle)).toBeInTheDocument()
    })
})
