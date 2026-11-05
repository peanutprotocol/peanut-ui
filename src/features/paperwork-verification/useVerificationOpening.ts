'use client'

import { useEffect } from 'react'
import { useOptionalAuth } from '@/context/authContext'
import { serverFetch } from '@/utils/api-fetch'
import { captureSessionFence } from '@/utils/session-fence'
import type { paths } from '@/types/api.generated'

type Opening = paths['/users/kyc/opened']['post']
type Feature = NonNullable<Opening['requestBody']>['content']['application/json']['feature']

/** The server owns the identity; these headers only reject stale entry contexts. */
export async function recordVerificationOpened(
    userId: string,
    scope: string,
    signal: AbortSignal,
    feature?: Feature
): Promise<void> {
    const fence = captureSessionFence(userId, () => !signal.aborted)
    await serverFetch('/users/kyc/opened', {
        method: 'POST',
        headers: { 'x-kyc-entry-user': userId, 'x-kyc-entry-scope': scope } satisfies Opening['parameters']['header'],
        body: JSON.stringify((feature ? { feature } : {}) satisfies NonNullable<Opening['requestBody']>['content']['application/json']),
        signal,
        beforeDispatch: fence.current,
        timeoutMs: 10_000,
        callerReportsFailures: true,
        redactTelemetry: true,
    })
}

/** Only a scope returned with the questions actually shown can authorize an entry. */
export function useVerificationOpening(visible: boolean, scope?: string, feature?: Feature): void {
    const userId = useOptionalAuth()?.user?.user?.userId
    useEffect(() => {
        if (!visible || !userId || !scope || !/^[a-f0-9]{64}$/.test(scope)) return
        const controller = new AbortController()
        void recordVerificationOpened(userId, scope, controller.signal, feature).catch(() => undefined)
        return () => controller.abort()
    }, [visible, userId, scope, feature])
}
