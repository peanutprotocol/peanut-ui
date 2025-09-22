import { validateInviteCode } from '@/app/actions/invites'
import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'
import Cookies from 'js-cookie'

export const invitesApi = {
    acceptInvite: async (inviteCode: string): Promise<any> => {
        const jwtToken = Cookies.get('jwt-token')
        const response = await fetchWithSentry(`${PEANUT_API_URL}/invites`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${jwtToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ inviteCode, type: 'DIRECT' }),
        })
        return response.json()
    },

    getInvites: async () => {
        const jwtToken = Cookies.get('jwt-token')
        const response = await fetchWithSentry(`${PEANUT_API_URL}/invites`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${jwtToken}`,
                'Content-Type': 'application/json',
            },
        })
        const invitesRes = await response.json()
        return invitesRes.invites
    },

    validateInviteCode: async (inviteCode: string): Promise<boolean> => {
        const res = await validateInviteCode(inviteCode)
        return res.data?.success || false
    },
}
