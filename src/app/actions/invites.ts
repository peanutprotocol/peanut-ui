import { serverFetch } from '@/utils/api-fetch'
import { parseLegacyInviteAcquisition, type LegacyInviteAcquisition } from '@/services/invite-acquisition'
import { isTypedCampaignOnlyInviteResponse, resolveInviteResolutionFlags } from '@/services/invite-response'

export async function validateInviteCode(inviteCode: string): Promise<{
    data?: {
        success: boolean
        attributionResolved: boolean
        onboardingResolved: boolean
        username: string
        legacyAcquisition?: LegacyInviteAcquisition
    }
    error?: string
}> {
    try {
        const response = await serverFetch('/invites/validate', {
            method: 'POST',
            body: JSON.stringify({ inviteCode }),
        })

        const data: unknown = await response.json()
        const typedCampaignOnly = response.status === 409 && isTypedCampaignOnlyInviteResponse(data)

        if (!response.ok && !typedCampaignOnly) {
            const error =
                data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
                    ? (data as { error: string }).error
                    : 'Failed to validate invite code.'
            return { error }
        }

        const body = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
        const username = typeof body.username === 'string' ? body.username : ''
        const resolution = resolveInviteResolutionFlags(data, username.trim().length > 0)
        const legacyAcquisition = parseLegacyInviteAcquisition(body.legacyAcquisition)

        return {
            data: {
                success: true,
                ...resolution,
                username,
                legacyAcquisition,
            },
        }
    } catch (error) {
        console.error('Error calling validate invite code API:', error)
        if (error instanceof Error) {
            return { error: error.message }
        }
        return { error: 'An unexpected error occurred.' }
    }
}
