// Tracks whether outbound API requests are currently reaching the backend, so
// the UI can surface a connectivity banner. Fed by fetchWithSentry at the
// network layer, which covers every request (React Query or raw), not just one
// call site. navigator.onLine only catches a hard offline device; the common
// real-world case is a request that hangs and times out while the device still
// reports itself online — that shows up here as a failure.

type Listener = () => void

const listeners = new Set<Listener>()
let consecutiveFailures = 0

function emit(): void {
    listeners.forEach((fn) => fn())
}

// A response came back (any status — a 4xx/5xx still means we reached the server).
export function reportNetworkOk(): void {
    if (consecutiveFailures === 0) return
    consecutiveFailures = 0
    emit()
}

// A request never reached the server (timeout / DNS / connection refused).
export function reportNetworkError(): void {
    consecutiveFailures += 1
    emit()
}

export function getConsecutiveFailures(): number {
    return consecutiveFailures
}

export function subscribeConnectivity(fn: Listener): () => void {
    listeners.add(fn)
    return () => {
        listeners.delete(fn)
    }
}
