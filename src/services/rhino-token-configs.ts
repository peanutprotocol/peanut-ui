'use client'

import { captureException } from '@sentry/nextjs'
import { fetchWithSentry } from '@/utils/sentry.utils'
import type { RhinoTokenConfigs } from '@/types/recover-funds'

/**
 * Rhino's public token list: no key, CORS `*`. Recover funds reads balances for
 * it on top of our own list, which misses tokens users strand most, such as
 * USDT on Arbitrum (TASK-23850).
 */
const RHINO_TOKEN_CONFIGS_URL = 'https://api.rhino.fi/bridge/bridge-swap-token-configs'
const RHINO_TOKEN_CONFIGS_TIMEOUT_MS = 8000

export async function fetchRhinoTokenConfigs(): Promise<RhinoTokenConfigs> {
    // fetchWithSentry reports a transport failure or a non-2xx itself
    const response = await fetchWithSentry(RHINO_TOKEN_CONFIGS_URL, { method: 'GET' }, RHINO_TOKEN_CONFIGS_TIMEOUT_MS)
    if (!response.ok) throw new Error(`Failed to fetch Rhino token configs: ${response.status}`)
    // A malformed 200 is the one failure fetchWithSentry never reports — it saw
    // a success. Capture it here, once.
    const body = (await response.json().catch(() => null)) as unknown
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        const error = new Error('Failed to fetch Rhino token configs: malformed 200 response')
        captureException(error)
        throw error
    }
    return body as RhinoTokenConfigs
}
