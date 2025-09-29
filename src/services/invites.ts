import { validateInviteCode } from '@/app/actions/invites'
import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'
import Cookies from 'js-cookie'
import { EInviteType, Invite } from './services.types'

export const invitesApi = {
    acceptInvite: async (inviteCode: string, type: EInviteType): Promise<{ success: boolean }> => {
        try {
            const jwtToken = Cookies.get('jwt-token')
            const response = await fetchWithSentry(`${PEANUT_API_URL}/invites/accept`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ inviteCode, type }),
            })
            if (!response.ok) {
                return { success: false }
            }
            return { success: true }
        } catch {
            return { success: false }
        }
    },

    getInvites: async (): Promise<Invite[]> => {
        try {
            const jwtToken = Cookies.get('jwt-token')
            if (!jwtToken) return []
            const response = await fetchWithSentry(`${PEANUT_API_URL}/invites`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${jwtToken}`,
                    'Content-Type': 'application/json',
                },
            })
            if (!response.ok) return []
            const invitesRes = await response.json().catch(() => ({}))
            return invitesRes.invites || []
        } catch {
            return []
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
            const token = Cookies.get('jwt-token')
            if (!token) return { success: false, position: 0 }

            const response = await fetchWithSentry(`${PEANUT_API_URL}/invites/waitlist-position`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
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
}
