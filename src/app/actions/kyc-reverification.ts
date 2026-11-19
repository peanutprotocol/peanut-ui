import { serverFetch } from '@/utils/api-fetch'
import { kycClientHeaders } from '@/utils/kyc-client-headers'
import { isFeatureReverificationEntry, isFeatureReverificationStatus } from '@/utils/kyc-reverification'
import type { FeatureReverificationStart, FeatureReverificationStartBody } from './types/kyc-reverification.types'

export type FeatureReverificationStartResult = FeatureReverificationStart | { error: string; code?: string }

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
        if (
            response.status === 409 &&
            body?.code === 'kyc_client_update_required' &&
            typeof body.userMessage === 'string'
        )
            return { error: body.userMessage, code: body.code }
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
