import { authReady, getAuthHeaders } from '@/utils/auth-token'
import { PEANUT_API_URL } from '@/constants/general.consts'
import { withStepUpHeader } from '@/services/step-up'
import { buildExplorerSearchParams } from './query'
import {
    PAYMENT_NETWORK_CONTRACT,
    PAYMENT_NETWORK_MEDIA_TYPE,
    type ExplorerRequest,
    type ExplorerSession,
    type FocusResponse,
    type PaymentNetworkResponse,
    type RevealReason,
    type RevealResponse,
} from './types'

const REQUEST_TIMEOUT_MS = 30_000

export class PaymentNetworkApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code?: string
    ) {
        super(message)
        this.name = 'PaymentNetworkApiError'
    }
}

function errorMessage(status: number): string {
    if (status === 401) return 'Your explorer session expired. Sign in again.'
    if (status === 403) return 'Your account does not have access to this explorer.'
    if (status === 404) return 'No matching user was found.'
    if (status === 409) return 'The explorer and API versions do not match. Refresh after both deploys finish.'
    if (status === 429) return 'Too many reveal attempts. Wait before trying again.'
    if (status === 400) return 'The selected filters are not valid.'
    return 'The live payment network is unavailable. Try again.'
}

function requestSignal(external?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const abort = () => controller.abort()
    if (external?.aborted) controller.abort()
    else external?.addEventListener('abort', abort, { once: true })
    return {
        signal: controller.signal,
        cleanup: () => {
            window.clearTimeout(timeout)
            external?.removeEventListener('abort', abort)
        },
    }
}

async function requestJson<T extends { contractVersion: string }>(
    path: string,
    options: RequestInit,
    externalSignal?: AbortSignal,
    expectedContentType = 'application/json',
    authenticateWithBearer = false
): Promise<T> {
    if (authenticateWithBearer) await authReady()
    const { signal, cleanup } = requestSignal(externalSignal)
    try {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
        const requestHeaders = {
            Accept: expectedContentType,
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...((options.headers as Record<string, string> | undefined) ?? {}),
        }
        const response = await fetch(`${PEANUT_API_URL}${path}`, {
            ...options,
            cache: 'no-store',
            credentials: 'include',
            headers: authenticateWithBearer ? getAuthHeaders(requestHeaders) : requestHeaders,
            signal,
        })

        if (!response.ok) {
            let code: string | undefined
            try {
                const body = (await response.json()) as { code?: unknown }
                code = typeof body.code === 'string' ? body.code : undefined
            } catch {}
            throw new PaymentNetworkApiError(errorMessage(response.status), response.status, code)
        }

        const responseContract = response.headers.get('X-Peanut-Graph-Contract')
        if (responseContract !== PAYMENT_NETWORK_CONTRACT) {
            throw new PaymentNetworkApiError(errorMessage(409), 409, 'CONTRACT_HEADER_MISMATCH')
        }
        if (!response.headers.get('Content-Type')?.toLowerCase().startsWith(expectedContentType.toLowerCase())) {
            throw new PaymentNetworkApiError(errorMessage(409), 409, 'CONTRACT_CONTENT_TYPE_MISMATCH')
        }
        const body = (await response.json()) as T
        if (body.contractVersion !== PAYMENT_NETWORK_CONTRACT) {
            throw new PaymentNetworkApiError(errorMessage(409), 409, 'CONTRACT_BODY_MISMATCH')
        }
        return body
    } catch (error) {
        if (error instanceof PaymentNetworkApiError) throw error
        if (error instanceof Error && error.name === 'AbortError') {
            throw new PaymentNetworkApiError('The live request timed out. Try a narrower window.', 408, 'TIMEOUT')
        }
        throw new PaymentNetworkApiError(errorMessage(503), 503, 'NETWORK_ERROR')
    } finally {
        cleanup()
    }
}

export function createExplorerSession(signal?: AbortSignal): Promise<ExplorerSession> {
    return requestJson('/invites/graph/session', { method: 'POST', body: '{}' }, signal, 'application/json', true)
}

export function fetchPaymentNetwork(request: ExplorerRequest, signal?: AbortSignal): Promise<PaymentNetworkResponse> {
    const params = buildExplorerSearchParams(request)
    return requestJson(`/invites/graph?${params.toString()}`, { method: 'GET' }, signal, PAYMENT_NETWORK_MEDIA_TYPE)
}

export function createExplorerFocus(username: string, signal?: AbortSignal): Promise<FocusResponse> {
    return requestJson(
        '/invites/graph/focus',
        { method: 'POST', body: JSON.stringify({ username: username.trim() }) },
        signal
    )
}

export async function revealExplorerNode(
    revealToken: string,
    reason: RevealReason,
    signal?: AbortSignal
): Promise<RevealResponse> {
    const headers = await withStepUpHeader({})
    return requestJson(
        '/invites/graph/reveal',
        { method: 'POST', headers, body: JSON.stringify({ revealToken, reason }) },
        signal
    )
}
