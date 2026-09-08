'use client'

import { useEffect } from 'react'

const KEYBOARD_NAVIGATION_KEYS = new Set([
    'Tab',
    'Enter',
    ' ',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
])

/**
 * Browsers can classify a pointer-focused text input as :focus-visible because
 * it accepts keyboard input. Keep the modality explicit so input styling can
 * distinguish a pointer focus from keyboard navigation consistently.
 */
export function InputModalityProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const root = document.documentElement
        root.dataset.inputModality = 'keyboard'

        const markPointer = () => {
            root.dataset.inputModality = 'pointer'
        }
        const markKeyboard = (event: KeyboardEvent) => {
            if (event.metaKey || event.altKey || event.ctrlKey) return
            if (!KEYBOARD_NAVIGATION_KEYS.has(event.key)) return
            root.dataset.inputModality = 'keyboard'
        }

        document.addEventListener('pointerdown', markPointer, true)
        document.addEventListener('keydown', markKeyboard, true)

        return () => {
            document.removeEventListener('pointerdown', markPointer, true)
            document.removeEventListener('keydown', markKeyboard, true)
            delete root.dataset.inputModality
        }
    }, [])

    return children
}
