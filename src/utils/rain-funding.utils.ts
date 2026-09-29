import { isAddress, isAddressEqual, zeroAddress, type Address } from 'viem'
import { RTF_SCOPE_RETIRED_REASON, RTF_SUPPORTED_SCOPE_VERSION } from '@/constants/rain.consts'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { apiErrorStatus, wireErrorCode } from '@/services/api-error'
import type { RainCardFunding, RainFundingManagementStatus } from '@/services/rain'

export type RainFundingError =
    /** A consent box is missing, or the statement shown is not the one the backend records. */
    | { kind: 'consent-required' }
    /** The terms text changed after the user read it. Nothing was signed. */
    | { kind: 'terms-changed' }
    /** The funding state could not be read. Never read as "not granted". */
    | { kind: 'funding-unavailable'; message: string }
    /** No card account exists yet, so there is no wallet to grant for. */
    | { kind: 'no-account' }
    /** Connected account is not the wallet the provider pulls from. */
    | { kind: 'wallet-mismatch' }
    /** Backend chain/token/operator/ceiling/signer are not a config this app can sign for. */
    | { kind: 'config-mismatch' }
    /** The signed-in account or the connected wallet changed mid-flow. Nothing was sent. */
    | { kind: 'account-changed' }
    | { kind: 'user-cancelled' }
    /** The legacy-grant invalidation is sent but not confirmed on chain yet. Re-check before sending again. */
    | { kind: 'migration-pending' }
    /** The backend refused the signed permission. Rebuild it from a fresh read. */
    | { kind: 'rejected' }
    /** The permission was retired on chain. It cannot be signed again; internal support is needed. Nothing was signed. */
    | { kind: 'scope-retired' }
    /** Funding is paused internally. Consent stands; there is nothing to sign and no retry. */
    | { kind: 'unavailable' }
    /** Another card signature or permission update is running on this wallet. Nothing was sent; try again shortly. */
    | { kind: 'busy' }
    | { kind: 'unexpected'; message: string }

export type RainFundingResult =
    | { ok: true; status: RainFundingManagementStatus }
    | { ok: false; error: RainFundingError }

/** What the user ticked. The authorization box is required and never implied. */
export interface RainFundingConsent {
    authorizationAccepted: boolean
    /** The authorization statement exactly as it was shown. */
    authorizationText: string
}

/**
 * Managed funding needs a grant only in these two states. Anything else —
 * including an unknown state — prompts nothing. A retired permission cannot be
 * signed again (the same permission id never reinstalls on chain), so it needs
 * internal support and never a prompt, whatever the status says.
 */
export const needsFundingGrant = (status: RainFundingManagementStatus | undefined, reason?: string | null): boolean =>
    reason !== RTF_SCOPE_RETIRED_REASON &&
    reason !== 'support_required' &&
    (status === 'required' || status === 'migration_required')

/**
 * The backend funding config must be the chain and token this app's wallet
 * runs on, with a real operator, a real session signer, a positive signed
 * ceiling and a scope this app understands. Checked BEFORE any kernel client
 * is built, so an unexpected config can never pick the chain we sign on.
 */
export const isRainFundingConfigValid = (funding: RainCardFunding): boolean => {
    try {
        return (
            funding.chainId === PEANUT_WALLET_CHAIN.id.toString() &&
            isAddress(funding.tokenAddress) &&
            isAddressEqual(funding.tokenAddress, PEANUT_WALLET_TOKEN as Address) &&
            isAddress(funding.operatorAddress) &&
            !isAddressEqual(funding.operatorAddress, zeroAddress) &&
            !isAddressEqual(funding.operatorAddress, funding.tokenAddress) &&
            isAddress(funding.walletAddress) &&
            isAddress(funding.sessionKeyAddress) &&
            !isAddressEqual(funding.sessionKeyAddress, zeroAddress) &&
            funding.permission.scopeVersion === RTF_SUPPORTED_SCOPE_VERSION &&
            BigInt(funding.permission.ceiling) > 0n &&
            funding.permission.termsVersion.length > 0 &&
            funding.permission.authorizationText.length > 0
        )
    } catch {
        return false
    }
}

/** The account that signs must be the wallet the provider pulls from. */
export const isRainFundingWallet = (funding: RainCardFunding, connectedAddress: Address | undefined): boolean =>
    !!connectedAddress && isAddressEqual(funding.walletAddress as Address, connectedAddress)

/**
 * Maps a failed funding read or grant to the error the UI branches on. Codes
 * are matched case-insensitively: the funding routes and the older card routes
 * spell them differently.
 */
export const classifyFundingApiError = (error: unknown): RainFundingError => {
    const code = wireErrorCode(error)?.toLowerCase()
    const status = apiErrorStatus(error)
    if (code === 'no_rain_account' || status === 404) return { kind: 'no-account' }
    if (code === 'card_wallet_mismatch') return { kind: 'wallet-mismatch' }
    if (code === 'consent_required') return { kind: 'consent-required' }
    if (code === 'invalid_permission') return { kind: 'rejected' }
    if (code === 'scope_retired' || code === 'permission_retire_required') return { kind: 'scope-retired' }
    if (code === 'support_required') return { kind: 'unavailable' }
    // The legacy grant is still valid on chain: the invalidation has not landed.
    if (code === 'migration_required') return { kind: 'migration-pending' }
    // 409 = paused internally (consent stands, no retry). 503 = a read failed (try again later).
    if (code === 'funding_unavailable' && status === 409) return { kind: 'unavailable' }
    if (code === 'funding_unavailable' || code === 'funding_status_unavailable') {
        return { kind: 'funding-unavailable', message: (error as Error)?.message ?? String(error) }
    }
    return { kind: 'unexpected', message: (error as Error)?.message ?? String(error) }
}

export const isUserCancellation = (error: unknown): boolean => {
    const name = (error as Error | undefined)?.name
    const message = ((error as Error | undefined)?.message ?? '').toLowerCase()
    return name === 'NotAllowedError' || message.includes('user rejected') || message.includes('cancelled')
}
