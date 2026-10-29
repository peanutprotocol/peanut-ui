import { isAddress, isAddressEqual, zeroAddress, type Address } from 'viem'
import {
    RTF_SCOPE_RETIRED_REASON,
    RTF_SUPPORTED_SCOPE_VERSION,
    RTF_WITHDRAWAL_IN_FLIGHT_REASON,
} from '@/constants/rain.consts'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { apiErrorStatus, wireErrorCode } from '@/services/api-error'
import type { RainCardFunding, RainFundingAccess, RainFundingManagementStatus } from '@/services/rain'

/**
 * Which card funding setup this account is offered, from the server's
 * decision only: managed once the account is managed (whatever the rollout
 * flag says now), or while new enrollment is open to it; otherwise the
 * existing card permission. Unknown (no answer yet, or a failed read) is
 * undefined, and callers then offer and sign nothing.
 */
export const fundingSetupPath = (access: RainFundingAccess | undefined): 'managed' | 'legacy' | undefined =>
    !access ? undefined : access.fundingMode === 'managed' || access.enrollmentAllowed ? 'managed' : 'legacy'

/** The signed-in user and connected wallet a card flow was started for. */
export interface CardFlowIdentity {
    userId?: string
    connectedAddress?: string
}

/** Same user and same wallet: anything else stops a flow before its next request or signature. */
export const sameIdentity = (a: CardFlowIdentity, b: CardFlowIdentity): boolean =>
    a.userId === b.userId && a.connectedAddress === b.connectedAddress

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
    /** Backend chain/token/spender/ceiling/signer are not a config this app can sign for. */
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
    /** The card balance could not be read, so it is not known whether there is money to move first. Nothing was sent. */
    | { kind: 'balance-unavailable' }
    /** Moving the card balance to the wallet was sent and has not settled. Nothing else is sent until it has. */
    | { kind: 'return-pending' }
    /** The provider does not allow moving the card balance right now. Nothing moved. */
    | { kind: 'return-wait' }
    /** Moving the card balance could not finish. Check the balance and try again. */
    | { kind: 'return-failed' }
    /** A card withdrawal is still confirming. Nothing is retired or signed until it settles. */
    | { kind: 'withdrawal-in-flight' }
    /** New managed funding is not open to this account. Nothing was recorded, retired or signed. */
    | { kind: 'enrollment-not-allowed' }
    | { kind: 'unexpected'; message: string }

export type RainFundingResult =
    /** `returnError`: funding is ready, but moving the card balance back did not finish. */
    | { ok: true; status: RainFundingManagementStatus; returnError?: RainFundingError }
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
 * The backend holds the old permission's retirement while a card withdrawal it
 * submitted is still confirming. Setup is unfinished: never read this as done.
 */
export const isFundingWithdrawalInFlight = (funding: Pick<RainCardFunding, 'management'>): boolean =>
    funding.management.status === 'temporarily_unavailable' &&
    funding.management.reason === RTF_WITHDRAWAL_IN_FLIGHT_REASON

/**
 * The backend funding config must be the chain and token this app's wallet
 * runs on, with a real spender, a real session signer, a positive signed
 * ceiling and a scope this app understands. Checked BEFORE any kernel client
 * is built, so an unexpected config can never pick the chain we sign on.
 */
export const isRainFundingConfigValid = (funding: RainCardFunding): boolean => {
    try {
        return (
            funding.chainId === PEANUT_WALLET_CHAIN.id.toString() &&
            isAddress(funding.tokenAddress) &&
            isAddressEqual(funding.tokenAddress, PEANUT_WALLET_TOKEN as Address) &&
            isAddress(funding.spenderAddress) &&
            !isAddressEqual(funding.spenderAddress, zeroAddress) &&
            !isAddressEqual(funding.spenderAddress, funding.tokenAddress) &&
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
    // not admitted, or no longer open to new accounts: nothing is signed
    if (code === 'enrollment_not_allowed' || code === 'enrollment_required') return { kind: 'enrollment-not-allowed' }
    if (code === 'card_action_in_progress') return { kind: 'busy' }
    if (code === 'funding_access_unavailable') {
        return { kind: 'funding-unavailable', message: (error as Error)?.message ?? String(error) }
    }
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
