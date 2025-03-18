import { fetchWithSentry } from '@/utils'
import { PEANUT_API_URL } from '@/constants'
import { AccountType } from '@/interfaces'

type ApiAccount = {
    identifier: string
    type: AccountType
}

type ApiUser = {
    username: string
    accounts: ApiAccount[]
}

export const usersApi = {
    getByUsername: async (username: string): Promise<ApiUser> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/users/username/${username}`)
        return await response.json()
    },
}
