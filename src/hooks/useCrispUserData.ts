import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'
import { useMemo } from 'react'

const GRAFANA_DASHBOARD_BASE_URL =
    'https://teampeanut.grafana.net/d/ad31f645-81ca-4779-bfb2-bff8e03d9057/explore-peanut-wallet-user'
const ARBISCAN_ADDRESS_BASE_URL = 'https://arbiscan.io/address'

export interface CrispUserData {
    username: string | undefined
    userId: string | undefined
    email: string | undefined
    fullName: string | undefined
    avatar: string | undefined
    grafanaLink: string | undefined
    walletAddress: string | undefined
    walletAddressLink: string | undefined
    bridgeUserId: string | undefined
    mantecaUserId: string | undefined
}

/**
 * Prepares user data for Crisp chat integration
 * Extracts user information from auth context and formats it for Crisp
 */
export function useCrispUserData(): CrispUserData {
    const { username, userId, user } = useAuth()

    return useMemo(() => {
        const grafanaLink = username
            ? `${GRAFANA_DASHBOARD_BASE_URL}?orgId=1&var-GRAFANA_VAR_Username=${encodeURIComponent(username)}&from=now-30d&to=now&timezone=browser`
            : undefined

        const walletAddress =
            user?.accounts?.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier || undefined
        const walletAddressLink = walletAddress ? `${ARBISCAN_ADDRESS_BASE_URL}/${walletAddress}` : undefined

        const bridgeUserId = user?.user?.bridgeCustomerId || undefined
        const mantecaUserId =
            user?.user?.kycVerifications?.find((kyc) => kyc.provider === 'MANTECA')?.providerUserId || undefined

        return {
            username,
            userId,
            email: user?.user?.email || undefined,
            fullName: user?.user?.fullName,
            avatar: user?.user?.profile_picture || undefined,
            grafanaLink,
            walletAddress,
            walletAddressLink,
            bridgeUserId,
            mantecaUserId,
        }
    }, [username, userId, user])
}
