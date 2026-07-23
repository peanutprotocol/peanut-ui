import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'
import { useMemo } from 'react'
import {
    GRAFANA_DASHBOARD_BASE_URL,
    ARBISCAN_ADDRESS_BASE_URL,
    POSTHOG_PERSON_BASE_URL,
    BRIDGE_DASHBOARD_BASE_URL,
} from '@/constants/support'
import { buildSupportVerificationSummary } from '@/utils/support-verification'

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
    // Live verification state so agents stop guessing where a user is stuck (#2360).
    identityStatus: string | undefined
    emailOnFile: boolean | undefined
    verificationGates: string | undefined
    verificationRails: string | undefined
    failureReason: string | undefined
    pendingActions: string | undefined
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
        // DATA GAP (flagged): the Manteca providerUserId used to come from the now-removed
        // raw `user.kycVerifications` field. Neither read-model carries it — `capabilities`
        // is provider-blind, `identityVerification` has no provider metadata. This was only
        // an internal support-dashboard convenience link (not user-facing, not a gate), so
        // it degrades to undefined until the backend exposes a provider-account id. Do NOT
        // fabricate it from capabilities.
        const mantecaUserId = undefined

        const posthogPersonLink = userId ? `${POSTHOG_PERSON_BASE_URL}/${userId}` : undefined

        const email = user?.user?.email || undefined
        const verification = user
            ? buildSupportVerificationSummary(user.capabilities, user.identityVerification, email)
            : undefined

        return {
            username,
            userId,
            email,
            fullName: user?.user?.fullName,
            avatar: user?.user?.profile_picture || undefined,
            grafanaLink,
            walletAddress,
            walletAddressLink,
            bridgeCustomerLink,
            mantecaUserId,
            posthogPersonLink,
            identityStatus: verification?.identityStatus,
            emailOnFile: verification?.emailOnFile,
            verificationGates: verification?.gates,
            verificationRails: verification?.verificationRails,
            failureReason: verification?.failureReason,
            pendingActions: verification?.pendingActions,
        }
    }, [username, userId, user])
}
