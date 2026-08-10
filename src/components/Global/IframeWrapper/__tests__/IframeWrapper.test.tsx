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
