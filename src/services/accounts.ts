import { apiFetch } from '@/utils/api-fetch'
import { apiErrorFromResponse } from './api-error'
import type { Account } from '@/interfaces/interfaces'

export const accountsApi = {
    /** Name a saved account, or clear the name with an empty string. */
    rename: async (id: string, label: string): Promise<Account> => {
        const response = await apiFetch(`/users/accounts/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ label }),
        })
        if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to rename account')
        const body = (await response.json()) as { account: Account }
        return body.account
    },
}
