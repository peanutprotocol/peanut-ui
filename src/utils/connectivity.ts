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
//
// Two deliberate choices, both from review:
// - Truth is an array of Date.now() stamps pruned on read, NOT the timers:
//   browsers throttle/suspend setTimeout in background tabs and on sleep, so a
//   counter decremented by timers can wake up stale. The per-failure timer
//   only exists to notify subscribers once the window has passed.
// - The count is DISTINCT endpoints, not raw failures: React Query retries
//   (FAST = 3 attempts) make one persistently slow route produce 3 failures in
//   seconds, which must not trip the app-wide banner. A genuinely bad
//   connection fails several endpoints at once.

interface FailureEntry {
    t: number
    endpoint: string
}

const listeners = new Set<() => void>()

export const FAILURE_WINDOW_MS = 60_000

// Treat the API as unreachable at this many DISTINCT failing endpoints inside
// the window; lives here next to the window so the whole policy reads in one place.
export const FAILURE_THRESHOLD = 2

let failures: FailureEntry[] = []
const expiryTimers = new Set<ReturnType<typeof setTimeout>>()

function emit(): void {
    listeners.forEach((fn) => fn())
}

function prune(): void {
    const now = Date.now()
    failures = failures.filter((f) => now - f.t < FAILURE_WINDOW_MS)
}

// A request never completed (timeout / DNS / connection refused). `endpoint`
// should be a sanitized url so retries of the same route dedupe to one entry.
export function reportNetworkError(endpoint: string): void {
    prune()
    failures.push({ t: Date.now(), endpoint })
    // notify again once this entry has aged out so subscribers re-read the
    // pruned count; on freeze/sleep the overdue timer fires at resume, which
    // is exactly when a re-read is needed.
    const timer = setTimeout(() => {
        expiryTimers.delete(timer)
        emit()
    }, FAILURE_WINDOW_MS + 50)
    expiryTimers.add(timer)
    emit()
}

// Distinct endpoints that failed inside the current window.
export function getRecentFailures(): number {
    prune()
    return new Set(failures.map((f) => f.endpoint)).size
}

// The device just came back online — the recorded failures belong to the dead
// connection, so drop them instead of showing "trouble reaching Peanut" for
// up to a window while requests are already succeeding.
export function clearRecentFailures(): void {
    if (failures.length === 0) return
    failures = []
    expiryTimers.forEach((t) => clearTimeout(t))
    expiryTimers.clear()
    emit()
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
    failures = []
    listeners.clear()
}
