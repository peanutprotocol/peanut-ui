import { useCallback, useEffect, useState } from 'react'
import { Clipboard } from '@capacitor/clipboard'
import { extractPaymentValue, type PasteFieldKind } from '@/utils/clipboard-extract.utils'

export function useClipboardSuggestion(kind: PasteFieldKind, currentValue: string, enabled: boolean) {
    const [suggestion, setSuggestion] = useState<string | null>(null)

    useEffect(() => {
        if (currentValue) setSuggestion(null)
    }, [currentValue])

    const check = useCallback(async () => {
        if (currentValue) return
        try {
            // Capacitor Clipboard reads via the native bridge on device (no user
            // gesture needed), and its web shim falls back to navigator.clipboard.
            const { value } = await Clipboard.read()
            const text = (value ?? '').trim()
            if (!text) return
            setSuggestion(extractPaymentValue(text, kind))
        } catch {
            // permission denied or API unavailable
        }
    }, [kind, currentValue])

    useEffect(() => {
        if (!enabled) return
        const timer = setTimeout(check, 1000)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled])

    const dismiss = useCallback(() => setSuggestion(null), [])

    return { suggestion, check, dismiss }
}
