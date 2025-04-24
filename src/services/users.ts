import { PEANUT_API_URL } from '@/constants'
import { AccountType } from '@/interfaces'
import { fetchWithSentry } from '@/utils'

type ApiAccount = {
    identifier: string
    type: AccountType
}

export type ApiUser = {
    userId: string
    username: string
    accounts: ApiAccount[]
    fullName: string
    firstName: string
    lastName: string
}

export interface UserSearchResponse {
    users: Array<ApiUser>
}

export const usersApi = {
    getByUsername: async (username: string): Promise<ApiUser> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/username/${username}`)
        return await response.json()
    },

    search: async (query: string): Promise<UserSearchResponse> => {
        if (query.length < 3) throw new Error('Search query must be at least 3 characters')
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/search?q=${query}`)
        return await response.json()
    },
}
