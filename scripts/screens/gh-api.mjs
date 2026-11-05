import { execFileSync } from 'node:child_process'

const BACKOFF_MS = [2000, 5000]
const NETWORK_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'])

const sleepSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

const text = (value) => (value == null ? '' : Buffer.isBuffer(value) ? value.toString('utf8') : String(value))

// Returns the HTTP status gh reports (e.g. "gh: HTTP 502"), else undefined.
export function ghErrorStatus(error) {
    const match = /\bHTTP (\d{3})\b/.exec(`${text(error?.stderr)}\n${text(error?.message)}`)
    return match ? Number(match[1]) : undefined
}

// Transient: 5xx, 429, secondary rate limits, timeouts and network errors. Other 4xx mean absence or denial.
export function isTransientGhError(error) {
    const status = ghErrorStatus(error)
    if (status !== undefined) {
        if (status >= 500 || status === 429) return true
        if (status === 403)
            return /secondary rate limit|abuse detection|retry-after/i.test(text(error.stderr) + text(error.message))
        return false
    }
    if (error?.killed || error?.signal === 'SIGTERM' || NETWORK_CODES.has(error?.code)) return true
    return /timed out|ETIMEDOUT|ECONNRESET|connection reset|EOF|TLS handshake|no such host|temporary failure/i.test(
        `${text(error?.stderr)}\n${text(error?.message)}`
    )
}

export function ghApiSync(
    args,
    options = {},
    { run = execFileSync, sleep = sleepSync, backoff = BACKOFF_MS, log = (line) => process.stderr.write(line) } = {}
) {
    const attempts = backoff.length + 1
    for (let attempt = 1; ; attempt++) {
        try {
            return run('gh', ['api', ...args], options)
        } catch (error) {
            if (attempt >= attempts || !isTransientGhError(error)) throw error
            const label = ghErrorStatus(error) ?? error?.code ?? (error?.killed ? 'timeout' : 'network error')
            log(
                `gh api retry: ${label} on attempt ${attempt}/${attempts}, retrying in ${backoff[attempt - 1] / 1000}s\n`
            )
            sleep(backoff[attempt - 1])
        }
    }
}
