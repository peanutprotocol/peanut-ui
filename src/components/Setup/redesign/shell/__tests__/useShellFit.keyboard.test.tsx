/** @jest-environment jsdom */
// TASK-25063: iOS scrolls the page to show a focused field and keeps that offset once the page shrinks for the
// keyboard, so the shell rides up under the status bar. The page must stay at the top while a shell field has focus.
import { act, renderHook } from '@testing-library/react'
import { useShellFit } from '../useShellFit'

let scrollY = 0

beforeEach(() => {
    scrollY = 0
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
    window.scrollTo = ((_x: number, y: number) => {
        scrollY = y
    }) as typeof window.scrollTo
    // a phone: the keyboard device query matches
    window.matchMedia = ((query: string) => ({
        matches: true,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
})

afterEach(() => {
    document.body.innerHTML = ''
})

function mount() {
    const shell = document.createElement('div')
    const probe = document.createElement('div')
    const input = document.createElement('input')
    input.type = 'email'
    shell.append(probe, input)
    const outside = document.createElement('input')
    document.body.append(shell, outside)
    renderHook(() =>
        useShellFit({ shellRef: { current: shell }, probeRef: { current: probe }, stage: 'std', screenId: 'signup' })
    )
    return { input, outside }
}

/** what iOS does when the keyboard opens: it scrolls the page to the field */
const iosScrollsPage = () =>
    act(() => {
        scrollY = 269
        window.dispatchEvent(new Event('scroll'))
    })

describe('useShellFit: the page under the keyboard', () => {
    it('puts the page back at the top when it scrolls while a shell field has focus', () => {
        const { input } = mount()
        input.focus()
        iosScrollsPage()
        expect(window.scrollY).toBe(0)
    })

    it('leaves the page alone when no shell field has focus', () => {
        const { outside } = mount()
        iosScrollsPage()
        expect(window.scrollY).toBe(269)
        // a field outside the shell (a drawer's search) is not the shell's to pin
        outside.focus()
        iosScrollsPage()
        expect(window.scrollY).toBe(269)
    })
})
