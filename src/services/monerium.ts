import { apiFetch } from '@/utils/api-fetch'
import { ApiError, apiErrorFromResponse } from './api-error'
import type { CurrencyHistoryEntry } from './currency-accounts'
import type { Hex } from 'viem'

export type MoneriumStep = 'share' | 'form' | 'link' | 'iban' | 'wait' | 'done' | 'unavailable'
export type MoneriumOnboarding = {
    state: string
    nextStep: MoneriumStep
    iban: string | null
    reason: string | null
}
export type MoneriumCapabilities = {
    provider: 'MONERIUM'
    receive: boolean
    bankDeposit: boolean
    bankWithdraw: boolean
    send: false
    exchange: false
    onboarding: MoneriumStep
    iban: string | null
    bankingBlock: 'unavailable' | null
}
export type MoneriumOperation = {
    operationId: string
    id?: string
    status: 'READY' | 'SUBMITTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'NEEDS_REVIEW'
    errorCode: string | null
    amount?: string
}
export type MoneriumPreparedWithdrawal = { operationId: string; message: string; status: MoneriumOperation['status'] }
export type MoneriumWithdrawInput = { requestKey: string; amount: string; externalAccountId: string }
export type MoneriumHistoryResponse = {
    entries: (Omit<CurrencyHistoryEntry, 'asset'> & { asset: 'EURE' })[]
    operations: (MoneriumOperation & {
        id: string
        kind: string
        amount: string
        sourceAsset: 'EURE'
        requestKey?: string
        externalAccountId?: string | null
    })[]
    cursor: string | null
    hasMore: boolean
}

async function request<T>(suffix: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await apiFetch(`/users/currency-accounts/EURE/${suffix}`, {
        method,
        signal,
        timeoutMs: 30_000,
        redactTelemetry: true,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (!response.ok) {
        // Only this provider uses arbitrary wire codes in `error`. Preserve the
        // shared parser's semantics for every other API consumer.
        let text = ''
        try {
            text = await response.text()
        } catch {
            /* Keep the fallback and HTTP status. */
        }
        const parsed = await apiErrorFromResponse(
            { status: response.status, text: async () => text } as Response,
            'EUR account request failed'
        )
        let code = parsed.code
        try {
            const body: unknown = JSON.parse(text)
            if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' && body.error) {
                code ??= body.error
            }
        } catch {
            /* An unreadable response is still an API failure. */
        }
        throw new ApiError(parsed.message, { status: parsed.status, code, retryAfterSec: parsed.retryAfterSec })
    }
    return response.json()
}

export const moneriumApi = {
    onboarding: (signal?: AbortSignal) => request<MoneriumOnboarding>('onboarding', 'GET', undefined, signal),
    share: () => request<MoneriumOnboarding>('onboarding/share', 'POST'),
    submitForm: (answers: Record<string, unknown>) => request<MoneriumOnboarding>('onboarding/form', 'POST', answers),
    linkMessage: () => request<{ message: string }>('onboarding/link-message'),
    link: (signature: Hex) => request<MoneriumOnboarding>('onboarding/link', 'POST', { signature }),
    requestIban: () => request<MoneriumOnboarding>('onboarding/iban', 'POST'),
    capabilities: (signal?: AbortSignal) => request<MoneriumCapabilities>('capabilities', 'GET', undefined, signal),
    prepareWithdraw: (input: MoneriumWithdrawInput) =>
        request<MoneriumPreparedWithdrawal>('operations', 'POST', { ...input, kind: 'BANK_WITHDRAW' }),
    submitWithdraw: (id: string, signature: Hex) =>
        request<MoneriumOperation>(`operations/${encodeURIComponent(id)}/submit`, 'POST', { signature }),
    operation: (id: string, signal?: AbortSignal) =>
        request<MoneriumOperation>(`operations/${encodeURIComponent(id)}`, 'GET', undefined, signal),
    history: (cursor?: string, signal?: AbortSignal) =>
        request<MoneriumHistoryResponse>(
            `history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
            'GET',
            undefined,
            signal
        ),
}
