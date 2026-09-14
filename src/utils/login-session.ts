import { PasskeyServerError } from './webauthn.utils'

export async function recoverLoginSession<T>(load: () => Promise<T | null>, cancel: () => Promise<void>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    let expired = false
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            expired = true
            void cancel().catch(() => {})
            reject(new PasskeyServerError(new Error('Session hydration timed out')))
        }, 15_000)
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
        return await Promise.race([recovery(), timeout])
    } finally {
        clearTimeout(timer)
    }
}
