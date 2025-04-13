import { fetchWithSentry } from '@/utils'
import { PEANUT_API_URL } from '@/constants'
import { AccountType } from '@/interfaces'

type ApiAccount = {
    identifier: string
    type: AccountType
}

type ApiUser = {
    userId: string
    username: string
    accounts: ApiAccount[]
    fullName: string
    firstName: string
    lastName: string
}

export const usersApi = {
    getByUsername: async (username: string): Promise<ApiUser> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/username/${username}`)
        return await response.json()
    },

    search: async (query: string): Promise<ApiUser[]> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/search?q=${query}`)
        return await response.json()
    },
}
