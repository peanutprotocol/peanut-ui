/**
 * The marketing layout owns the launcher's visibility through this component's
 * lifetime. Unmount is the load-bearing half: leaving marketing for the app is
 * a client-side navigation in the same document, so nothing else removes the
 * bubble.
 */
import React from 'react'
import { act, render } from '@testing-library/react'
import { CrispLauncher } from '../CrispLauncher'
import { isCapacitor } from '@/utils/capacitor'
import { isNativeHelpContext } from '@/utils/native-help-context'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))
jest.mock('@/utils/native-help-context', () => ({ isNativeHelpContext: jest.fn(() => false) }))

const queued = () => (window.$crisp ?? []) as unknown[][]
const SCRIPT_SELECTOR = 'script[src="https://client.crisp.chat/l.js"]'
const script = () => document.head.querySelector(SCRIPT_SELECTOR)
const setReadyState = (value: DocumentReadyState) =>
    Object.defineProperty(document, 'readyState', { configurable: true, get: () => value })

beforeEach(() => {
    jest.mocked(isCapacitor).mockReturnValue(false)
    jest.mocked(isNativeHelpContext).mockReturnValue(false)
    window.$crisp = undefined
    document.head.querySelectorAll(SCRIPT_SELECTOR).forEach((el) => el.remove())
    setReadyState('complete')
})

describe('CrispLauncher', () => {
    it('shows the launcher while a marketing page is mounted', () => {
        render(<CrispLauncher />)

        expect(queued()).toContainEqual(['do', 'chat:show'])
        expect(script()).not.toBeNull()
    })

    it('hides the launcher when marketing unmounts — the app must never see it', () => {
        const { unmount } = render(<CrispLauncher />)

        unmount()

        expect(queued().slice(-2)).toEqual([
            ['do', 'chat:close'],
            ['do', 'chat:hide'],
        ])
    })

    it('shows it again when the reader returns to marketing', () => {
        const first = render(<CrispLauncher />)
        first.unmount()

        render(<CrispLauncher />)

        expect(queued().at(-1)).toEqual(['do', 'chat:show'])
    })
})

describe('CrispLauncher — deferred load', () => {
    it('does not fetch the Crisp bundle while the page is still loading', () => {
        setReadyState('loading')

        render(<CrispLauncher />)

        expect(script()).toBeNull()
        // the show is queued regardless, so the late script replays it and a
        // #chat tap before the bundle lands is not lost
        expect(queued()).toContainEqual(['do', 'chat:show'])
    })

    it('fetches it once the page has loaded', () => {
        setReadyState('loading')
        render(<CrispLauncher />)

        act(() => {
            window.dispatchEvent(new Event('load'))
        })

        expect(script()).not.toBeNull()
    })

    it('never fetches it when the reader leaves marketing before the page finishes loading', () => {
        setReadyState('loading')
        const { unmount } = render(<CrispLauncher />)

        unmount()
        act(() => {
            window.dispatchEvent(new Event('load'))
        })

        expect(script()).toBeNull()
        expect(queued().slice(-2)).toEqual([
            ['do', 'chat:close'],
            ['do', 'chat:hide'],
        ])
    })
})

describe('CrispLauncher — native support', () => {
    it.each(['browser sheet', 'native webview'])('suppresses the duplicate launcher in the %s', (surface) => {
        jest.mocked(isNativeHelpContext).mockReturnValue(surface === 'browser sheet')
        jest.mocked(isCapacitor).mockReturnValue(surface === 'native webview')
        const { unmount } = render(<CrispLauncher />)
        // Keep explicit support links functional, but never show the bubble by default.
        expect(script()).not.toBeNull()
        expect(queued()).not.toContainEqual(['do', 'chat:show'])
        expect(queued().slice(0, 2)).toEqual([
            ['do', 'chat:close'],
            ['do', 'chat:hide'],
        ])
        const onClosed = queued().find((command) => command[0] === 'on' && command[1] === 'chat:closed')?.[2]
        expect(onClosed).toEqual(expect.any(Function))
        ;(onClosed as () => void)()
        expect(queued().slice(-1)).toEqual([['do', 'chat:hide']])
        unmount()
        expect(queued()).toContainEqual(['off', 'chat:closed'])
    })
})
