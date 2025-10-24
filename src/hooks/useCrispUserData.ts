import { useAuth } from '@/context/authContext'
import { useMemo } from 'react'

export interface CrispUserData {
    username: string | undefined
    userId: string | undefined
    email: string | undefined
    grafanaLink: string | undefined
}

export function useCrispUserData(): CrispUserData {
    const { username, userId } = useAuth()

    return useMemo(() => {
        const grafanaLink = username
            ? `https://teampeanut.grafana.net/d/ad31f645-81ca-4779-bfb2-bff8e03d9057/explore-peanut-wallet-user?orgId=1&var-GRAFANA_VAR_Username=${encodeURIComponent(username)}`
            : undefined

        return {
            username,
            userId,
            email: undefined,
            grafanaLink,
        }
    }, [username, userId])
}
