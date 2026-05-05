import { validateInviteCode } from '@/app/actions/invites'
import { serverFetch } from '@/utils/api-fetch'
import { EInviteType, type PointsInvitesResponse } from './services.types'

export const invitesApi = {
    acceptInvite: async (
        inviteCode: string,
        type: EInviteType,
        campaignTag?: string
    ): Promise<{ success: boolean }> => {
        try {
            const response = await serverFetch('/invites/accept', {
                method: 'POST',
                body: JSON.stringify({ inviteCode, type, campaignTag }),
            })
            if (!response.ok) {
                return { success: false }
            }
            return { success: true }
        } catch {
            return { success: false }
        }
    },

    getInvites: async (): Promise<PointsInvitesResponse> => {
        try {
            const response = await serverFetch('/points/invites', {
                method: 'GET',
            })
            if (!response.ok) {
                throw new Error('Failed to fetch invites')
            }
            const invitesRes: PointsInvitesResponse = await response.json()
            return invitesRes
        } catch (e) {
            console.log(e)
            throw new Error('Failed to fetch invites')
        }
    },

    validateInviteCode: async (inviteCode: string): Promise<{ success: boolean; username: string }> => {
        try {
            const res = await validateInviteCode(inviteCode)
            return {
                success: res.data?.success || false,
                username: res.data?.username || '',
            }
        } catch (e) {
            console.error('Error validating invite code:', e)
            return { success: false, username: '' }
        }
    },

    getWaitlistQueuePosition: async (): Promise<{ success: boolean; position: number }> => {
        try {
            const response = await serverFetch('/invites/waitlist-position', {
                method: 'GET',
            })

            if (!response.ok) {
                return { success: false, position: 0 }
            }

            const data = await response.json()
            return { success: true, position: Number(data.queuePosition) || 0 }
        } catch (e) {
            console.error('Error getting waitlist queue position:', e)
            return { success: false, position: 0 }
        }
    },

    awardBadge: async (campaignTag: string): Promise<{ success: boolean }> => {
        try {
            const response = await serverFetch('/badge/award', {
                method: 'POST',
                body: JSON.stringify({ campaignTag }),
            })
            if (!response.ok) {
                return { success: false }
            }
            return { success: true }
        } catch (e) {
            console.error('Error awarding badge:', e)
            return { success: false }
        }
    },
}
