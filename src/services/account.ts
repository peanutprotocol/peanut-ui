import { apiFetch } from '@/utils/api-fetch'

// Self-service account deletion (V1). Disables the account server-side and
// starts the 30-day data-deletion clock. The user is taken from the JWT, so
// there is no body — a user can only delete their own account.
export const accountApi = {
    requestDeletion: async (): Promise<void> => {
        const res = await apiFetch('/users/me/delete', { method: 'POST' })
        if (!res.ok) {
            throw new Error('Failed to request account deletion')
        }
    },
}
