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
const ACTIVATION_KEYS = new Set(['Enter', ' '])
const NON_EDITABLE_INPUT_TYPES = new Set([
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
])

function isEditableControl(target: EventTarget | null) {
    if (target instanceof HTMLTextAreaElement) return true
    if (target instanceof HTMLInputElement) return !NON_EDITABLE_INPUT_TYPES.has(target.type)
    return target instanceof HTMLElement && target.isContentEditable
}

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
            if (ACTIVATION_KEYS.has(event.key) && isEditableControl(event.target)) return
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
