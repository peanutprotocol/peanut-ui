import { useEffect } from 'react'

/**
 * Kills the OS long-press link/HTML preview on app-shell interactive elements
 * (nav CTAs, profile menu rows, drawer buttons):
 *
 * - iOS callout: the `.app-no-callout` body class applies
 *   `-webkit-touch-callout: none` to anchors and buttons (globals.css). It
 *   goes on <body> so portaled drawers are covered too.
 * - Android context menu: a document-level `contextmenu` guard prevents the
 *   default only when the press lands on an anchor or button — inputs,
 *   textareas and selectable text keep their native menus (paste, selection).
 *
 * Mounted by the (mobile-ui) app layout only, so marketing and content pages
 * keep normal link long-press behavior.
 */
export function useLongPressGuard(): void {
    useEffect(() => {
        document.body.classList.add('app-no-callout')
        const onContextMenu = (e: Event) => {
            const target = e.target as Element | null
            if (!target?.closest) return
            if (target.closest('input,textarea,[contenteditable="true"]')) return
            if (target.closest('a,button')) e.preventDefault()
        }
        document.addEventListener('contextmenu', onContextMenu)
        return () => {
            document.body.classList.remove('app-no-callout')
            document.removeEventListener('contextmenu', onContextMenu)
        }
    }, [])
}
