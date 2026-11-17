import { getUsernameHoldToken } from '@/features/setup/username-reservation'
import { apiFetch } from '@/utils/api-fetch'

const SUGGESTIBLE = /^[a-z][a-z0-9]{3,11}$/

/**
 * WAITING FOR ITS API ROUTE: `POST /users/username/suggest` does not exist yet (TASK-24908, "Invite step: suggest
 * close usernames when the inviter is not found"). Only the `signup-rollout-inviter-suggestions` flag (default off)
 * lets the invite step call this, so production never sends the request until the route ships. The shape is the
 * contract's proposal (mono _temp/signup-redesign/r2/r9/build/contract/P2.md § 7); the route owner and the
 * api-contract check set the final one, and this moves into src/services/invites.ts with the route.
 *
 * The person has no account at this step, so the pre-account username hold token identifies the caller for the
 * quota. Returns up to two usernames; any failure (400, 429, network) returns none, and the step shows no chips.
 */
export async function fetchInviterSuggestions(username: string): Promise<string[]> {
    if (!SUGGESTIBLE.test(username)) return []
    try {
        const response = await apiFetch('/users/username/suggest', {
            method: 'POST',
            headers: { 'x-username-hold': await getUsernameHoldToken() },
            body: JSON.stringify({ username }),
            includeAuth: false,
            timeoutMs: 5000,
            redactTelemetry: true,
            callerReportsFailures: true,
        })
        if (!response.ok) return []
        const body: { suggestions?: unknown } = await response.json()
        if (!Array.isArray(body.suggestions)) return []
        return body.suggestions.filter((name): name is string => typeof name === 'string').slice(0, 2)
    } catch {
        return []
    }
}
