import posthog from 'posthog-js'
import * as Sentry from '@/utils/sentry-lazy'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { apiFetch } from './api-fetch'
import { REQUIRED_API_CONTRACTS } from '@/constants/api-contracts.json'

export { REQUIRED_API_CONTRACTS }

export type ApiVersion = {
    commit: string | null
    branch: string | null
    builtAt: string | null
    migrationsHead: string | null
    contracts: Record<string, number>
}
export type ApiCompatibility = {
    status: 'loading' | 'compatible' | 'incompatible' | 'unknown'
    version: ApiVersion | null
    contractError: boolean
}

const LEGACY_API: ApiVersion = {
    commit: null,
    branch: null,
    builtAt: null,
    migrationsHead: null,
    contracts: { kyc: 0 },
}

let state: ApiCompatibility = { status: 'loading', version: null, contractError: false }
let pending: Promise<void> | undefined
const listeners = new Set<() => void>()

export const isTestApiBuild = () => Boolean(process.env.NEXT_PUBLIC_TEST_BUILD_BRANCH)
export const getApiCompatibility = () => state
export function subscribeApiCompatibility(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}
function update(next: ApiCompatibility) {
    state = next
    listeners.forEach((listener) => listener())
}

function captureWarning(message: string, extra: Record<string, unknown>, tags?: Record<string, string>): void {
    try {
        Sentry.captureMessage(message, { level: 'warning', extra, ...(tags ? { tags } : {}) })
    } catch {}
}

function validVersion(value: unknown): value is ApiVersion {
    if (!value || typeof value !== 'object') return false
    const version = value as ApiVersion
    return (
        ['commit', 'branch', 'builtAt', 'migrationsHead'].every((key) => {
            const field = version[key as keyof ApiVersion]
            return field === null || (typeof field === 'string' && field.length <= 256)
        }) &&
        !!version.contracts &&
        typeof version.contracts === 'object' &&
        Object.keys(REQUIRED_API_CONTRACTS).every(
            (key) => Number.isSafeInteger(version.contracts[key]) && version.contracts[key] >= 0
        )
    )
}

export function reportApiContractError(route: string, method: string, reason: string, status?: number): void {
    update({ ...state, contractError: true })
    captureWarning(
        'API contract error',
        {
            route,
            method,
            reason,
            status,
            app_commit: process.env.NEXT_PUBLIC_GIT_COMMIT_HASH ?? null,
            api_commit: state.version?.commit ?? null,
        },
        route.startsWith('/users/kyc/') || route.startsWith('/users/identity')
            ? { ...criticalFlowTags('kyc'), kyc_step: 'api_contract' }
            : undefined
    )
}

export function loadApiVersion(): Promise<void> {
    if (pending) return pending
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    // apiFetch answers demo sessions and dev fixtures itself; /version needs no token.
    const request = () =>
        apiFetch('/version', { includeAuth: false, signal: controller.signal, cache: 'no-store', credentials: 'omit' })
    const read = async (): Promise<ApiVersion> => {
        const response = await request()
        if (response.status === 404) return LEGACY_API
        if (!response.ok) throw new Error('API version unavailable')
        const value: unknown = await response.json()
        if (!validVersion(value)) throw new Error('Invalid API version')
        return value
    }
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            controller.abort()
            reject(new Error('API version timeout'))
        }, 5000)
    })
    pending = Promise.race([read(), timeout])
        .then(
            (version) => {
                const incompatible = Object.entries(REQUIRED_API_CONTRACTS).some(
                    ([key, required]) => (version.contracts[key] ?? 0) < required
                )
                update({ ...state, status: incompatible ? 'incompatible' : 'compatible', version })
                // Production talks to an API without /version until that API ships; only report a real mismatch there.
                if (incompatible && (isTestApiBuild() || version !== LEGACY_API)) {
                    const extra = {
                        app_commit: process.env.NEXT_PUBLIC_GIT_COMMIT_HASH ?? null,
                        api_commit: version.commit,
                        required_contracts: REQUIRED_API_CONTRACTS,
                        api_contracts: Object.fromEntries(
                            Object.keys(REQUIRED_API_CONTRACTS).map((key) => [key, version.contracts[key]])
                        ),
                    }
                    captureWarning('API too old for this build', extra)
                    try {
                        posthog.capture('api_contract_mismatch', extra)
                    } catch {}
                }
            },
            () => {
                update({ ...state, status: 'unknown' })
            }
        )
        .finally(() => clearTimeout(timer))
    return pending
}
