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
// A success does not clear the count; each failure expires on its own timer
// (store-owned expiry, same shape as useSubmissionWindow), so subscribers are
// always notified when the count changes — no consumer-side timer math.

const listeners = new Set<() => void>()

export const FAILURE_WINDOW_MS = 60_000

// Treat the API as unreachable at this many failures inside the window; lives
// here next to the window so the whole policy reads in one place.
export const FAILURE_THRESHOLD = 2

let recentFailures = 0
const expiryTimers = new Set<ReturnType<typeof setTimeout>>()

function emit(): void {
    listeners.forEach((fn) => fn())
}

// A request never reached the server (timeout / DNS / connection refused).
export function reportNetworkError(): void {
    recentFailures += 1
    const timer = setTimeout(() => {
        expiryTimers.delete(timer)
        recentFailures -= 1
        emit()
    }, FAILURE_WINDOW_MS)
    expiryTimers.add(timer)
    emit()
}

// Failures inside the current window.
export function getRecentFailures(): number {
    return recentFailures
}

export function subscribeConnectivity(fn: () => void): () => void {
    listeners.add(fn)
    return () => {
        listeners.delete(fn)
    }
}

// test-only: module state is shared across tests
export function __resetConnectivityForTests(): void {
    expiryTimers.forEach((t) => clearTimeout(t))
    expiryTimers.clear()
    recentFailures = 0
    listeners.clear()
}
