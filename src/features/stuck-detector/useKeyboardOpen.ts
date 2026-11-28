'use client'

import { useEffect, useState } from 'react'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { getPlatform } from '@/utils/capacitor'

function isEditableElement(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    if (target.isContentEditable) return true
    const tag = target.tagName
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (tag === 'INPUT') {
        const type = (target as HTMLInputElement).type.toLowerCase()
        return type !== 'checkbox' && type !== 'radio' && type !== 'button' && type !== 'submit' && type !== 'range'
    }
    return false
}

/**
 * Reliable web + native software-keyboard detector.
 *
 * `capacitor.config.ts` sets `Keyboard.resize: 'native'`, which shrinks the native WebView
 * instead of shifting `visualViewport`, leaving `useVisualViewport().keyboardInset === 0`.
 * Combining Capacitor Keyboard events, editable focus state, and `useVisualViewport` keeps
 * the buddy off the screen whenever a user is typing on iOS, Android, or web.
 */
export function useKeyboardOpen(enabled: boolean): boolean {
    const { keyboardInset } = useVisualViewport(enabled)
    const [nativeKeyboardOpen, setNativeKeyboardOpen] = useState(false)
    const [editableFocused, setEditableFocused] = useState(false)

    useEffect(() => {
        if (!enabled || typeof document === 'undefined') {
            setEditableFocused(false)
            return
        }
        setEditableFocused(isEditableElement(document.activeElement))
        const onFocusIn = (event: FocusEvent) => {
            if (isEditableElement(event.target)) setEditableFocused(true)
        }
        const onFocusOut = () => {
            window.setTimeout(() => {
                setEditableFocused(isEditableElement(document.activeElement))
            }, 0)
        }
        document.addEventListener('focusin', onFocusIn, true)
        document.addEventListener('focusout', onFocusOut, true)
        return () => {
            document.removeEventListener('focusin', onFocusIn, true)
            document.removeEventListener('focusout', onFocusOut, true)
        }
    }, [enabled])

    useEffect(() => {
        const platform = getPlatform()
        if (!enabled || (platform !== 'ios-native' && platform !== 'android-native')) {
            setNativeKeyboardOpen(false)
            return
        }
        let cancelled = false
        const handles: Array<{ remove: () => Promise<void> | void }> = []

        void import('@capacitor/keyboard')
            .then(async ({ Keyboard }) => {
                if (cancelled) return
                const registered = await Promise.all([
                    Keyboard.addListener('keyboardWillShow', () => setNativeKeyboardOpen(true)),
                    Keyboard.addListener('keyboardDidShow', () => setNativeKeyboardOpen(true)),
                    Keyboard.addListener('keyboardWillHide', () => setNativeKeyboardOpen(false)),
                    Keyboard.addListener('keyboardDidHide', () => setNativeKeyboardOpen(false)),
                ])
                if (cancelled) {
                    registered.forEach((h) => void h.remove())
                } else {
                    handles.push(...registered)
                }
            })
            .catch(() => {
                // Native plugin unavailable (web/test) — focus + visualViewport fallback still active.
            })

        return () => {
            cancelled = true
            handles.forEach((h) => void h.remove())
        }
    }, [enabled])

    return enabled && (keyboardInset > 0 || nativeKeyboardOpen || editableFocused)
}
