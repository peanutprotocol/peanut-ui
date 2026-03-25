import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'
import { useMemo } from 'react'
import {
    GRAFANA_DASHBOARD_BASE_URL,
    ARBISCAN_ADDRESS_BASE_URL,
    POSTHOG_PERSON_BASE_URL,
    BRIDGE_DASHBOARD_BASE_URL,
} from '@/constants/support'

export interface CrispUserData {
    username: string | undefined
    userId: string | undefined
    email: string | undefined
    fullName: string | undefined
    avatar: string | undefined
    grafanaLink: string | undefined
    walletAddress: string | undefined
    walletAddressLink: string | undefined
    bridgeCustomerLink: string | undefined
    mantecaUserId: string | undefined
    posthogPersonLink: string | undefined
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

        // Use address from user.accounts (database) rather than useWallet hook
        // This ensures we always show the user's wallet address in support metadata,
        // even if ZeroDev client isn't initialized yet. useWallet().address could be
        // undefined during initialization, but we want persistent data for support agents.
        const walletAddress =
            user?.accounts?.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier || undefined
        const walletAddressLink = walletAddress ? `${ARBISCAN_ADDRESS_BASE_URL}/${walletAddress}` : undefined

        const bridgeCustomerId = user?.user?.bridgeCustomerId || undefined
        const bridgeCustomerLink = bridgeCustomerId ? `${BRIDGE_DASHBOARD_BASE_URL}/${bridgeCustomerId}` : undefined
        // TODO: Manteca dashboard uses a numeric short ID (e.g. 2685955), but we only store
        // the long UUID (providerUserId). Converting requires an extra API call to Manteca.
        // When/if we add that, change this to a full link like bridgeCustomerLink.
        const mantecaUserId =
            user?.user?.kycVerifications?.find((kyc) => kyc.provider === 'MANTECA')?.providerUserId || undefined

        const posthogPersonLink = userId ? `${POSTHOG_PERSON_BASE_URL}/${userId}` : undefined

        return {
            username,
            userId,
            email: user?.user?.email || undefined,
            fullName: user?.user?.fullName,
            avatar: user?.user?.profile_picture || undefined,
            grafanaLink,
            walletAddress,
            walletAddressLink,
            bridgeCustomerLink,
            mantecaUserId,
            posthogPersonLink,
        }
    }, [username, userId, user])
}
