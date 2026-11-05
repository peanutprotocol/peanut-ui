import { apiFetch } from '@/utils/api-fetch'
import type { UserListPage, UserRecord, UserRecordStats, UserSort } from './userRecords.types'

export class UserRecordsError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message)
    }
}

// Customer PII: keep URLs and bodies out of fetch telemetry.
async function getJson<T>(path: string): Promise<T> {
    const response = await apiFetch(path, { redactTelemetry: true, callerReportsFailures: true })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
        const message =
            response.status === 403
                ? 'Only the Peanut team can open user records. Sign in with your team account.'
                : response.status === 401
                  ? 'Sign in to Peanut to open user records.'
                  : (body as { error?: string }).error || `The request failed (${response.status}).`
        throw new UserRecordsError(message, response.status)
    }
    return body as T
}

export function fetchUserRecordStats() {
    return getJson<UserRecordStats>('/admin/users/stats')
}

export function fetchUserList({ query, sort, before }: { query: string; sort: UserSort; before?: string | null }) {
    const params = new URLSearchParams({ sort })
    if (query) params.set('q', query)
    if (before) params.set('before', before)
    return getJson<UserListPage>(`/admin/users?${params}`)
}

export function fetchUserRecord(userId: string) {
    return getJson<UserRecord>(`/admin/users/${encodeURIComponent(userId)}`)
}
