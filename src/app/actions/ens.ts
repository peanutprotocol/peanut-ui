import { unstable_cache } from '@/utils/no-cache'
import { serverFetch } from '@/utils/api-fetch'

export const resolveEns = unstable_cache(
    async (ensName: string): Promise<string | undefined> => {
        const response = await serverFetch(`/ens/${ensName}`, {
            method: 'GET',
        })
        if (response.status === 404) return undefined

        const data: { address: string } = await response.json()

        return data.address
    },
    ['resolveEns'],
    {
        revalidate: 5 * 60, // 5 minutes
    }
)
