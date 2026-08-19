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
import { render as rtlRender, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import IframeWrapper from '../index'

const render = (ui: React.ReactElement) => rtlRender(<IntlWrapper>{ui}</IntlWrapper>)

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
}))

let mockIsAndroidNativeBridge = false
jest.mock('@/utils/capacitor', () => ({
    isAndroidNativeBridge: () => mockIsAndroidNativeBridge,
}))

const mockBrowserOpen = jest.fn<Promise<void>, [{ url: string }]>(() => Promise.resolve())
const mockRemoveListener = jest.fn()
let browserFinished: (() => void) | undefined
jest.mock(
    '@capacitor/browser',
    () => ({
        Browser: {
            open: (options: { url: string }) => mockBrowserOpen(options),
            addListener: (_event: string, cb: () => void) => {
                browserFinished = cb
                return Promise.resolve({ remove: mockRemoveListener })
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
    it("handles its OWN iframe's completion and ToS messages", () => {
        const onClose = jest.fn()
        render(<IframeWrapper src="https://one.test/flow" visible onClose={onClose} />)
        const own = findIframe('https://one.test/flow').contentWindow

        postFrom(own, { name: 'complete', metadata: { status: 'completed' } })
        expect(onClose).toHaveBeenCalledWith('completed')

        postFrom(own, { signedAgreementId: 'sig-1' })
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

    it('still frames the page on every other platform', async () => {
        render(<IframeWrapper src="https://compliance.test/tos" visible onClose={jest.fn()} />)
        await flush()

        expect(findIframe('https://compliance.test/tos')).toBeTruthy()
        expect(mockBrowserOpen).not.toHaveBeenCalled()
    })
})
