/** @jest-environment jsdom */
// The shell lift (Kush, 2026-11-18): panel content that would run under the footer shrinks the stage instead.
import { act, renderHook } from '@testing-library/react'
import { useShellFit } from '../useShellFit'

const size = (el: HTMLElement, props: Record<string, number>) => {
    for (const [key, value] of Object.entries(props)) Object.defineProperty(el, key, { configurable: true, value })
}

/** A 375x667 shell: the std stage is 344 px, the panel's one child starts at its 32 px padding. */
function shellDom(contentPx: number) {
    const shell = document.createElement('div')
    const probe = document.createElement('div')
    const slide = document.createElement('div')
    slide.setAttribute('data-setup-slide', 'residence')
    const panel = document.createElement('div')
    panel.setAttribute('data-setup-panel', '')
    const content = document.createElement('div')
    panel.append(content)
    slide.append(panel)
    shell.append(probe, slide)
    document.body.append(shell)
    size(shell, { clientHeight: 667 })
    size(probe, { offsetHeight: 344 })
    size(content, { offsetTop: 32, offsetHeight: contentPx })
    return { shell, content }
}

function fit(contentPx: number, footerTop: number | null) {
    const { shell } = shellDom(contentPx)
    const { result } = renderHook(() =>
        useShellFit({
            shellRef: { current: shell },
            probeRef: { current: shell.firstElementChild as HTMLDivElement },
            stage: 'std',
            screenId: 'residence',
        })
    )
    act(() => result.current.onFooterTop(footerTop))
    return shell
}

afterEach(() => {
    document.body.innerHTML = ''
})

describe('useShellFit: the lift', () => {
    it('lifts the stage by the overflow plus 16 px when the content would run under the footer', () => {
        // footer top 555: the panel has 555 - 344 = 211 px; the content ends at 32 + 200 = 232
        const shell = fit(200, 555)
        expect(shell.style.getPropertyValue('--sr-fit-lift')).toBe('37px')
        expect(shell.dataset.fold).toBeUndefined()
    })

    it('does not lift content that fits, or a screen without a footer (the web landing scrolls)', () => {
        expect(fit(170, 555).style.getPropertyValue('--sr-fit-lift')).toBe('')
        document.body.innerHTML = ''
        expect(fit(400, null).style.getPropertyValue('--sr-fit-lift')).toBe('')
    })

    it('stops 96 px under the headline; the rest scrolls in the panel', () => {
        // no headline here: under the title = 12 px, so the stage keeps 12 + 96 = 108 px and lifts at most 236
        expect(fit(900, 555).style.getPropertyValue('--sr-fit-lift')).toBe('236px')
    })

    it('re-fits when the content grows without the shell resizing (a callout appears)', async () => {
        const { shell, content } = shellDom(150)
        const { result } = renderHook(() =>
            useShellFit({
                shellRef: { current: shell },
                probeRef: { current: shell.firstElementChild as HTMLDivElement },
                stage: 'std',
                screenId: 'residence',
            })
        )
        act(() => result.current.onFooterTop(555))
        expect(shell.style.getPropertyValue('--sr-fit-lift')).toBe('')
        // a callout mounts inside the panel
        size(content, { offsetTop: 32, offsetHeight: 240 })
        const panel = shell.querySelector('[data-setup-panel]')!
        // MutationObserver callbacks run as a microtask
        await act(async () => {
            panel.append(document.createElement('div'))
        })
        // the content now ends at 32 + 240 = 272, 61 px past the footer
        expect(shell.style.getPropertyValue('--sr-fit-lift')).toBe('77px')
    })
})

describe('useShellFit: the fold', () => {
    it('folds the stage under the whole headline block, so the line under the headline stays on the stage', () => {
        const { shell } = shellDom(100)
        const slide = shell.querySelector('[data-setup-slide]')!
        const layer = document.createElement('div')
        layer.setAttribute('data-setup-art-layer', '')
        const block = document.createElement('div')
        block.setAttribute('data-setup-title', '')
        const h1 = document.createElement('h1')
        const line = document.createElement('p')
        block.append(h1, line)
        layer.append(block)
        slide.append(layer)
        const rect = (bottom: number) => ({ top: 0, bottom, left: 0, right: 0, width: 0, height: bottom }) as DOMRect
        h1.getBoundingClientRect = () => rect(120)
        block.getBoundingClientRect = () => rect(160)
        const { result } = renderHook(() =>
            useShellFit({
                shellRef: { current: shell },
                probeRef: { current: shell.firstElementChild as HTMLDivElement },
                stage: 'std',
                screenId: 'landing',
            })
        )
        // footer top 400: 400 - 344 leaves under 96 px of panel, so the stage folds
        act(() => result.current.onFooterTop(400))
        expect(shell.dataset.fold).toBe('title')
        // under the block (160) + 12, not under the h1 (120 + 12)
        expect(shell.style.getPropertyValue('--sr-fold-stage')).toBe('172px')
    })
})
