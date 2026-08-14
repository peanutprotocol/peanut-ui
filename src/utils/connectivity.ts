// Tracks whether outbound API requests are currently reaching the backend, so
// the UI can surface a connectivity banner. Fed by fetchWithSentry at the
// network layer, which covers every request (React Query or raw), not just one
// call site. navigator.onLine only catches a hard offline device; the common
// real-world case is a request that hangs and times out while the device still
// reports itself online — that shows up here as a failure.
//
// Failures are counted in a sliding time window, not consecutively. The app
// fires many requests in parallel, so on a flaky connection successes
// interleave with failures — a consecutive counter reset by any success never
// reaches its threshold, which kept the banner permanently dark (TASK-21108).
// Entries expire on their own; a success does not clear them.

type Listener = () => void

const listeners = new Set<Listener>()

export const FAILURE_WINDOW_MS = 60_000

let failureTimes: number[] = []

function emit(): void {
    listeners.forEach((fn) => fn())
}

function prune(now: number): void {
    failureTimes = failureTimes.filter((t) => now - t < FAILURE_WINDOW_MS)
}

// A request never reached the server (timeout / DNS / connection refused).
export function reportNetworkError(): void {
    const now = Date.now()
    prune(now)
    failureTimes.push(now)
    emit()
}

// Failures inside the current window.
export function getRecentFailures(): number {
    prune(Date.now())
    return failureTimes.length
}

// ms until the oldest in-window failure ages out, or null when there are none.
export function getMsUntilNextExpiry(): number | null {
    const now = Date.now()
    prune(now)
    if (failureTimes.length === 0) return null
    return FAILURE_WINDOW_MS - (now - failureTimes[0])
}

// test-only: module state is shared across tests
export function resetConnectivity(): void {
    failureTimes = []
}

export function subscribeConnectivity(fn: Listener): () => void {
    listeners.add(fn)
    return () => {
        listeners.delete(fn)
    }
}
