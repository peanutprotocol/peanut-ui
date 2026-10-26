import { useCallback, useRef } from 'react'

const newKey = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

/**
 * One idempotency key per user submission of a create form.
 *
 * `keyFor(body)` answers the same key while the body is unchanged: the
 * automatic resend and a manual re-tap of the same form reuse it, so the API
 * answers with the record the first attempt made. Any change to the body gives
 * a new key; the API refuses a known key with a different body (409).
 */
export function useSubmissionKey() {
    const last = useRef<{ key: string; body: string } | null>(null)
    return useCallback((body: unknown): string => {
        const serialized = JSON.stringify(body)
        if (last.current?.body !== serialized) last.current = { key: newKey(), body: serialized }
        return last.current.key
    }, [])
}
