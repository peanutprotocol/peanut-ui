import { useQuery } from '@tanstack/react-query'
import { PEANUT_API_URL } from '@/constants/general.consts'

interface RedirectQrStatusData {
    claimed: boolean
    available: boolean
    redirectUrl?: string
    claimedAt?: string
}

async function fetchRedirectQrStatus(code: string): Promise<RedirectQrStatusData> {
    const response = await fetch(`${PEANUT_API_URL}/qr/${code}`)
    const result = await response.json()

    if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch redirect QR status')
    }

    return result
}

export function useRedirectQrStatus(code: string | null | undefined) {
    return useQuery({
        queryKey: ['redirect-qr-status', code],
        queryFn: () => fetchRedirectQrStatus(code!),
        enabled: !!code,
        staleTime: 0, // Always fetch fresh data for redirect QR status
        refetchOnMount: true,
    })
}
