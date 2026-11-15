/*
 * What the web OneSignal SDK was doing when a push identity call ran out of time.
 * Kept apart from web.adapter.ts: importing react-onesignal injects the SDK
 * script, and the failure reporter is loaded on every page.
 */

const ONESIGNAL_DB = 'ONE_SIGNAL_SDK_DB'
const ONESIGNAL_WORKER_SCOPE = '/onesignal/'

const progress: { initStartedAt?: number; sdkReadyAt?: number; initSettledAt?: number; initOutcome?: string } = {}

const now = () => Math.round(typeof performance !== 'undefined' ? performance.now() : Date.now())

export const webInitProgress = {
    started: () => {
        progress.initStartedAt ??= now()
    },
    sdkReady: () => {
        progress.sdkReadyAt ??= now()
    },
    settled: (outcome: 'resolved' | 'rejected') => {
        progress.initSettledAt ??= now()
        progress.initOutcome ??= outcome
    },
}

function within<T>(work: Promise<T>, fallback: T, budgetMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    return Promise.race([
        work.catch(() => fallback),
        new Promise<T>((resolve) => {
            timer = setTimeout(() => resolve(fallback), budgetMs)
        }),
    ]).finally(() => clearTimeout(timer))
}

async function describeWorker(): Promise<string> {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return 'unsupported'
    const registrations = await navigator.serviceWorker.getRegistrations()
    const registration = registrations.find((candidate) => candidate.scope.endsWith(ONESIGNAL_WORKER_SCOPE))
    if (!registration) return 'none'
    const state = (worker: ServiceWorker | null) => worker?.state ?? '-'
    return `installing:${state(registration.installing)} waiting:${state(registration.waiting)} active:${state(registration.active)}`
}

/**
 * Opens the SDK database without a version, so it can never trigger an
 * upgrade. A database that does not exist yet is never created: an empty
 * version 1 would make the SDK skip creating its stores.
 */
async function probeDatabase(): Promise<string> {
    if (typeof indexedDB === 'undefined') return 'unsupported'
    if (typeof indexedDB.databases === 'function') {
        const databases = await indexedDB.databases()
        if (!databases.some((database) => database.name === ONESIGNAL_DB)) return 'absent'
    }
    return new Promise<string>((resolve) => {
        const request = indexedDB.open(ONESIGNAL_DB)
        request.onupgradeneeded = () => {
            request.transaction?.abort()
            resolve('absent')
        }
        request.onblocked = () => resolve('blocked')
        request.onerror = () => resolve(`error:${request.error?.name ?? 'unknown'}`)
        request.onsuccess = () => {
            const version = request.result.version
            request.result.close()
            resolve(`ok:v${version}`)
        }
    })
}

/** Never rejects and settles within about `budgetMs`. */
export async function collectPushSdkDiagnostics(budgetMs = 1500): Promise<Record<string, unknown>> {
    const sdk = (globalThis as { OneSignal?: { config?: unknown } }).OneSignal
    const [worker, database] = await Promise.all([
        within(describeWorker(), 'timeout', budgetMs),
        within(probeDatabase(), 'timeout', budgetMs),
    ])
    const controller = typeof navigator !== 'undefined' ? navigator.serviceWorker?.controller?.scriptURL : undefined
    return {
        ...progress,
        sdkLoaded: !!sdk,
        sdkConfigLoaded: !!sdk?.config,
        worker,
        database,
        controller: controller ? new URL(controller).pathname : null,
        visibility: typeof document !== 'undefined' ? document.visibilityState : undefined,
        online: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
        pageMs: now(),
    }
}
