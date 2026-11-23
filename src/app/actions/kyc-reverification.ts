import { serverFetch } from '@/utils/api-fetch'
import { kycClientHeaders } from '@/utils/kyc-client-headers'
import {
    isFeatureReverificationEntry,
    isFeatureReverificationOutcome,
    isFeatureReverificationStatus,
} from '@/utils/kyc-reverification'
import type {
    FeatureReverificationOutcome,
    FeatureReverificationStart,
    FeatureReverificationStartBody,
} from './types/kyc-reverification.types'

export type FeatureReverificationStartResult =
    | FeatureReverificationStart
    | { error: string; status?: number; code?: string; outcome?: FeatureReverificationOutcome; retryAfter?: string }

export async function startFeatureReverification(
    feature: FeatureReverificationStartBody['feature'],
    requestKey: string,
    beforeDispatch?: () => boolean
): Promise<FeatureReverificationStartResult> {
    try {
        const response = await serverFetch('/users/kyc/reverification', {
            method: 'POST',
            headers: kycClientHeaders(),
            body: JSON.stringify({ feature, requestKey } satisfies FeatureReverificationStartBody),
            cache: 'no-store',
            redactTelemetry: true,
            ...(beforeDispatch && { beforeDispatch }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok) {
            const display = [body?.userMessage, body?.message, body?.error].find(
                (value): value is string => typeof value === 'string' && value.trim().length > 0
            )
            const retryAfter = response.status === 503 ? response.headers?.get('Retry-After') : null
            return {
                error: display ?? '',
                status: response.status,
                ...(typeof body?.code === 'string' && { code: body.code }),
                ...(isFeatureReverificationOutcome(body?.outcome) && { outcome: body.outcome }),
                ...(retryAfter && { retryAfter }),
            }
        }
        if (
            response.status === 200 &&
            typeof body?.attemptId === 'string' &&
            isFeatureReverificationStatus(body.status) &&
            isFeatureReverificationEntry(body.entry) &&
            body.entry.attemptId === body.attemptId
        )
            return {
                attemptId: body.attemptId,
                status: body.status,
                entry: { ...body.entry, attemptId: body.attemptId },
            }
    } catch {
        // The request may have reached the server. The next tap reuses the request key.
    }
    return { error: '' }
}
