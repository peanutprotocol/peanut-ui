import { PasskeyServerError } from './webauthn.utils'
import { CLIENT_FETCH_TIMEOUT_MS, TRANSPORT_TIMEOUT_RETRY_DELAY_MS } from './sentry.utils'

export const LOGIN_SESSION_TIMEOUT_MS = CLIENT_FETCH_TIMEOUT_MS * 2 + TRANSPORT_TIMEOUT_RETRY_DELAY_MS + 5_000

export async function recoverLoginSession<T>(
    load: () => Promise<T | null>,
    cancel: () => Promise<void>,
    signal?: AbortSignal
): Promise<T> {
    if (signal?.aborted) throw new DOMException('Session hydration cancelled', 'AbortError')
    let timer: ReturnType<typeof setTimeout> | undefined
    let expired = false
    let stopListening = () => {}
    const cancelled = signal
        ? new Promise<never>((_, reject) => {
              const onAbort = () => {
                  expired = true
                  void cancel().catch(() => {})
                  reject(new DOMException('Session hydration cancelled', 'AbortError'))
              }
              signal.addEventListener('abort', onAbort, { once: true })
              stopListening = () => signal.removeEventListener('abort', onAbort)
          })
        : undefined
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            expired = true
            void cancel().catch(() => {})
            reject(new PasskeyServerError(new Error('Session hydration timed out')))
        }, LOGIN_SESSION_TIMEOUT_MS)
    })
    const recovery = async () => {
        let lastError: unknown
        for (let attempt = 0; attempt < 3 && !expired; attempt++) {
            try {
                const user = await load()
                if (user && !expired) return user
            } catch (error) {
                lastError = error
            }
            if (attempt < 2 && !expired) await new Promise((resolve) => setTimeout(resolve, 1000))
        }
        throw new PasskeyServerError(
            lastError instanceof Error ? lastError : new Error('Verified session did not hydrate')
        )
    }
    try {
        return await Promise.race(cancelled ? [recovery(), timeout, cancelled] : [recovery(), timeout])
    } finally {
        clearTimeout(timer)
        stopListening()
    }
}
