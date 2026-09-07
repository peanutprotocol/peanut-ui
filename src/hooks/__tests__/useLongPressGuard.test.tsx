import { renderHook } from '@testing-library/react'
import { useLongPressGuard } from '../useLongPressGuard'

const fireContextMenu = (el: Element) => {
    const event = new Event('contextmenu', { bubbles: true, cancelable: true })
    el.dispatchEvent(event)
    return event
}

describe('useLongPressGuard', () => {
    it('adds the body class while mounted and removes it on unmount', () => {
        const { unmount } = renderHook(() => useLongPressGuard())
        expect(document.body.classList.contains('app-no-callout')).toBe(true)
        unmount()
        expect(document.body.classList.contains('app-no-callout')).toBe(false)
    })

    it('prevents the context menu on anchors and buttons, but not on inputs', () => {
        renderHook(() => useLongPressGuard())
        const a = document.createElement('a')
        const button = document.createElement('button')
        const input = document.createElement('input')
        const p = document.createElement('p')
        document.body.append(a, button, input, p)

        expect(fireContextMenu(a).defaultPrevented).toBe(true)
        expect(fireContextMenu(button).defaultPrevented).toBe(true)
        expect(fireContextMenu(input).defaultPrevented).toBe(false)
        expect(fireContextMenu(p).defaultPrevented).toBe(false)

        a.remove()
        button.remove()
        input.remove()
        p.remove()
    })
})
