'use client'

import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { STEP_S } from './shell.motion'
import type { SetupStageSize } from './shell.types'

/** The keyboard counts as open when the visible height drops this far below the tallest height seen at this width. */
const KEYBOARD_MIN_PX = 120
/** Below this much panel between the stage and the footer, the stage folds (huge system text, a short window). */
const PANEL_MIN_PX = 96
/** With the keyboard open, the headline stays only if the panel keeps at least this much room for the field. */
const KEYBOARD_PANEL_MIN_PX = 112
/** Room under the headline or the top bar when the stage folds. */
const FOLD_GAP_PX = 12
/** Room kept under a focused field for its help or error line. */
const HELP_LINE_PX = 40

export type ShellFold = 'title' | 'bar'

const isTextEntry = (el: Element | null): el is HTMLElement => {
    if (!el || !(el instanceof HTMLElement)) return false
    if (el.isContentEditable || el.tagName === 'TEXTAREA') return true
    if (el.tagName !== 'INPUT') return false
    const type = (el as HTMLInputElement).type
    return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color', 'image', 'hidden'].includes(
        type
    )
}

const visibleHeight = () => Math.round(window.visualViewport?.height ?? window.innerHeight)
/**
 * Only a touch device or a phone-width window has an on-screen keyboard. A desktop window made shorter while a field
 * has focus is not a keyboard and must not fold the stage.
 */
const KEYBOARD_DEVICE_QUERY = '(pointer: coarse), (max-width: 767px)'

/** The field and the line that describes it (help, error) stay inside the panel's visible box. */
export function revealInPanel(field: HTMLElement) {
    const panel = field.closest<HTMLElement>('[data-setup-panel]')
    if (!panel) return
    const box = panel.getBoundingClientRect()
    const rect = field.getBoundingClientRect()
    let bottom = rect.bottom + HELP_LINE_PX
    for (const id of (field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)) {
        const line = document.getElementById(id)
        if (line && panel.contains(line)) bottom = Math.max(bottom, line.getBoundingClientRect().bottom + 8)
    }
    // the field's own top wins over its help line when both cannot show
    const down = Math.min(bottom - box.bottom, rect.top - box.top)
    if (down > 0) panel.scrollTop += down
    else if (rect.top < box.top) panel.scrollTop -= box.top - rect.top + 8
}

/**
 * Keeps every screen usable when the room shrinks (R2-02, R2-04). The panel already scrolls between the stage
 * and the footer; this hook adds two things.
 *
 * The on-screen keyboard: the native apps resize the page (`adjustResize`, Capacitor `resize: 'native'`) and a
 * browser shrinks only the visual viewport. Either way, while a text field in the shell has focus and the
 * visible height has dropped, the shell takes the visible height (`data-keyboard`), so the footer sits above the
 * keyboard, and the focused field is scrolled into the panel's visible part.
 *
 * The fold: when the keyboard is open, or the panel between the stage and the footer is too small to use (large
 * system text, a short window), the stage folds to just under the headline (`data-fold="title"`), or to the top
 * bar when even that leaves too little room (`data-fold="bar"`). The art hides while folded. No fold happens on
 * a regular phone at the default text size, so the approved layout is untouched.
 */
export function useShellFit({
    shellRef,
    probeRef,
    stage,
    screenId,
}: {
    shellRef: RefObject<HTMLDivElement | null>
    /** A hidden box whose height is the unfolded stage height (`--sr-stage-<stage>-base`). */
    probeRef: RefObject<HTMLDivElement | null>
    stage: SetupStageSize
    screenId: string
}) {
    const keyboard = useRef(false)
    const tallest = useRef<{ width: number; height: number }>({ width: 0, height: 0 })
    const footerTop = useRef<number | null>(null)

    const fit = useCallback(() => {
        const shell = shellRef.current
        const probe = probeRef.current
        // no layout (a test DOM): nothing to fit
        if (!shell || !probe || !shell.clientHeight) return
        let fold: ShellFold | null = null
        let foldPx = 0
        if (stage !== 'full') {
            const shellTop = shell.getBoundingClientRect().top
            const base = probe.offsetHeight
            const pad = parseFloat(getComputedStyle(shell).getPropertyValue('--sr-panel-pad')) || 0
            const footer = footerTop.current ?? shell.clientHeight
            if (keyboard.current || footer - (base + pad) < PANEL_MIN_PX) {
                const title = shell.querySelector('[data-setup-slide]:not([aria-hidden]) [data-setup-art-layer] h1')
                const bar = shell.querySelector('[data-setup-top-bar]')
                const titleBottom = title ? title.getBoundingClientRect().bottom - shellTop : 0
                const barBottom = bar ? bar.getBoundingClientRect().bottom - shellTop : 0
                const underTitle = Math.ceil(Math.max(titleBottom, barBottom) + FOLD_GAP_PX)
                const roomUnderTitle = footer - (underTitle + pad)
                const keepTitle = keyboard.current
                    ? roomUnderTitle >= KEYBOARD_PANEL_MIN_PX
                    : roomUnderTitle >= PANEL_MIN_PX
                fold = keepTitle ? 'title' : 'bar'
                foldPx = Math.min(base, keepTitle ? underTitle : Math.ceil(barBottom + FOLD_GAP_PX))
            }
        }
        if (fold) {
            shell.dataset.fold = fold
            shell.style.setProperty('--sr-fold-stage', `${foldPx}px`)
        } else {
            delete shell.dataset.fold
            shell.style.removeProperty('--sr-fold-stage')
        }
    }, [shellRef, probeRef, stage])

    /** The focused field back into view once the shell has settled at its new size. */
    const reveal = useCallback(() => {
        const shell = shellRef.current
        const field = document.activeElement
        if (!shell || !isTextEntry(field) || !shell.contains(field)) return
        revealInPanel(field)
    }, [shellRef])

    const syncKeyboard = useCallback(() => {
        const shell = shellRef.current
        if (!shell) return
        const width = window.innerWidth
        const height = visibleHeight()
        if (tallest.current.width !== width || height > tallest.current.height) tallest.current = { width, height }
        const field = document.activeElement
        const open =
            isTextEntry(field) &&
            shell.contains(field) &&
            height < tallest.current.height - KEYBOARD_MIN_PX &&
            window.matchMedia(KEYBOARD_DEVICE_QUERY).matches
        const changed = open !== keyboard.current
        keyboard.current = open
        if (open) {
            shell.dataset.keyboard = ''
            shell.style.setProperty('--sr-h', `calc(${height}px - var(--safe-top) - var(--safe-bottom))`)
        } else {
            delete shell.dataset.keyboard
            shell.style.removeProperty('--sr-h')
        }
        fit()
        if (open) {
            reveal()
            // again once the stage has folded and the panel has moved (500 ms)
            window.setTimeout(reveal, STEP_S * 1000 + 50)
        } else if (changed) window.setTimeout(fit, STEP_S * 1000 + 50)
    }, [shellRef, fit, reveal])

    useEffect(() => {
        const viewport = window.visualViewport
        const onFocus = () => window.setTimeout(syncKeyboard, 0)
        viewport?.addEventListener('resize', syncKeyboard)
        window.addEventListener('resize', syncKeyboard)
        document.addEventListener('focusin', onFocus)
        document.addEventListener('focusout', onFocus)
        // a help line that appears while typing must not slip under the footer
        const onInput = () => keyboard.current && window.setTimeout(reveal, 0)
        document.addEventListener('input', onInput)
        syncKeyboard()
        return () => {
            viewport?.removeEventListener('resize', syncKeyboard)
            window.removeEventListener('resize', syncKeyboard)
            document.removeEventListener('focusin', onFocus)
            document.removeEventListener('focusout', onFocus)
            document.removeEventListener('input', onInput)
        }
    }, [syncKeyboard, reveal])

    useLayoutEffect(() => {
        fit()
        const shell = shellRef.current
        if (!shell) return
        const observer = new ResizeObserver(() => fit())
        observer.observe(shell)
        return () => observer.disconnect()
    }, [fit, shellRef, screenId])

    /** The footer reports where its top edge rests (shell px), after its lifts. */
    const onFooterTop = useCallback(
        (top: number | null) => {
            if (footerTop.current === top) return
            footerTop.current = top
            fit()
        },
        [fit]
    )

    return { onFooterTop }
}
