import { serverFetch } from '@/utils/api-fetch'
import { ApiError } from '@/services/api-error'

export type ShakeLocation = { latitude: number; longitude: number; accuracyM: number }

export type ShakeCandidate = {
    username: string
    displayName: string | null
    avatarKey: string | null
    isVerified: boolean
}

export type ShakeSessionStatus = 'active' | 'expired' | 'cancelled'

export type ShakeSessionResponse = {
    sessionId: string
    shakenAt: string
    expiresAt: string
    status: ShakeSessionStatus
    candidates: ShakeCandidate[]
}

async function errorFrom(response: Response): Promise<ApiError> {
    let message = `Shake request failed (${response.status})`
    let code: string | undefined
    let retryAfterSec: number | undefined
    try {
        const body = JSON.parse(await response.text()) as Record<string, unknown>
        if (typeof body.error === 'string' && body.error) message = body.error
        if (typeof body.code === 'string' && body.code) code = body.code
        const retry = body.retryAfterSeconds
        if (typeof retry === 'number' && Number.isFinite(retry) && retry > 0) retryAfterSec = retry
    } catch {
        // non-JSON body: the status alone still classifies the failure
    }
    return new ApiError(message, { status: response.status, code, retryAfterSec })
}

async function readSession(response: Response): Promise<ShakeSessionResponse> {
    if (!response.ok) throw await errorFrom(response)
    return (await response.json()) as ShakeSessionResponse
}

const sessionPath = (sessionId: string) => `/shake/sessions/${encodeURIComponent(sessionId)}`

export const shakeApi = {
    async createSession(location?: ShakeLocation | null): Promise<ShakeSessionResponse> {
        const response = await serverFetch('/shake/sessions', {
            method: 'POST',
            body: JSON.stringify(location ? { location } : {}),
        })
        return readSession(response)
    },

    async getSession(sessionId: string): Promise<ShakeSessionResponse> {
        return readSession(await serverFetch(sessionPath(sessionId), { method: 'GET' }))
    },

    /** A session that is already gone is as good as cancelled. */
    async cancelSession(sessionId: string): Promise<void> {
        const response = await serverFetch(sessionPath(sessionId), { method: 'DELETE' })
        if (response.ok || response.status === 404) return
        throw await errorFrom(response)
    },
}
