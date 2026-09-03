import { serverFetch } from '@/utils/api-fetch'

/**
 * Records the tap. Idempotent server-side, and deliberately quiet: a failure
 * here costs the tester nothing they can act on, and the switch reveals itself
 * either way — the join is what needs the badge, and that is checked against
 * the freshly refetched user.
 */
export async function claimPeanutTeamBadge(): Promise<boolean> {
    try {
        const response = await serverFetch('/badge/team', { method: 'POST', body: JSON.stringify({}) })
        return response.ok
    } catch {
        return false
    }
}
