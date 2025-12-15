'use server'
import { unstable_cache } from 'next/cache'
import { fetchWithSentry } from '@/utils/sentry.utils'
import { PEANUT_API_URL } from '@/constants/general.consts'

const API_KEY = process.env.PEANUT_API_KEY!

export const resolveEns = unstable_cache(
    async (ensName: string): Promise<string | undefined> => {
        const response = await fetchWithSentry(`${PEANUT_API_URL}/ens/${ensName}`, {
            headers: {
                'api-key': API_KEY,
            },
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
