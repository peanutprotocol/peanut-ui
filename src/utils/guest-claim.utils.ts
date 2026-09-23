/**
 * Guest send-link claim to a bank account (TASK-22936).
 *
 * The API authorizes a guest bank claim with a signature from the link's own
 * key, which the guest holds in the `#p=` part of the link. The messages below
 * must match peanut-api-ts `src/bridge/guest-claim.ts` byte for byte.
 */
import { privateKeyToAccount } from 'viem/accounts'
import { generateKeysFromString, getParamsFromLink } from './peanut-link.utils'

/** Stable error codes from the guest claim routes. Mirrors peanut-api-ts. */
export const GUEST_CLAIM_ERROR_CODES = {
    invalidSignature: 'GUEST_CLAIM_INVALID_SIGNATURE',
    linkNotFound: 'GUEST_CLAIM_LINK_NOT_FOUND',
    linkNotClaimable: 'GUEST_CLAIM_LINK_NOT_CLAIMABLE',
    senderNotEligible: 'GUEST_CLAIM_SENDER_NOT_ELIGIBLE',
    amountMismatch: 'GUEST_CLAIM_AMOUNT_MISMATCH',
    overLimit: 'GUEST_CLAIM_OVER_LIMIT',
    alreadyClaimed: 'GUEST_CLAIM_ALREADY_CLAIMED',
    claimInProgress: 'GUEST_CLAIM_IN_PROGRESS',
    accountLimit: 'GUEST_CLAIM_ACCOUNT_LIMIT',
    accountMismatch: 'GUEST_CLAIM_ACCOUNT_MISMATCH',
} as const

export function guestBankAccountMessage(sendLinkPubKey: string): string {
    return `Peanut: add a bank account to claim send link ${sendLinkPubKey.toLowerCase()}`
}

export function guestBankClaimMessage(sendLinkPubKey: string, externalAccountId: string): string {
    return `Peanut: claim send link ${sendLinkPubKey.toLowerCase()} to bank account ${externalAccountId}`
}

/** The link's key pair, derived from the link URL. Stays on the device. */
function linkKeys(link: string) {
    return generateKeysFromString(getParamsFromLink(link).password)
}

export function getSendLinkPubKey(link: string): string {
    return linkKeys(link).address
}

/** Sign `message` with the send link's private key. */
export function signWithLinkKey(link: string, message: string): Promise<string> {
    return privateKeyToAccount(linkKeys(link).privateKey).signMessage({ message })
}

/**
 * The account owner's name as the provider records it: the business name for
 * a business, else first and last name. The API checks the travel-rule
 * beneficiary against it.
 */
export function accountOwnerNameOf(owner: { firstName?: string; lastName?: string; businessName?: string }): string {
    return owner.businessName?.trim() || `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim()
}

/** Which copy to show for a failed guest bank claim. */
export type GuestClaimErrorKind =
    | 'overLimit'
    | 'alreadyClaimed'
    | 'notClaimable'
    | 'unsupported'
    | 'linkInvalid'
    | 'inProgress'
    | 'accountLimit'

/**
 * Map a guest claim refusal to its copy. A 403 without a code is the shared
 * residence block on the sender, which the guest can only work around by
 * claiming to a wallet — the same answer as an ineligible sender.
 */
export function guestClaimErrorKind(code: string | undefined, status: number | undefined): GuestClaimErrorKind | null {
    switch (code) {
        case GUEST_CLAIM_ERROR_CODES.overLimit:
            return 'overLimit'
        case GUEST_CLAIM_ERROR_CODES.alreadyClaimed:
            return 'alreadyClaimed'
        case GUEST_CLAIM_ERROR_CODES.linkNotClaimable:
            return 'notClaimable'
        case GUEST_CLAIM_ERROR_CODES.senderNotEligible:
            return 'unsupported'
        case GUEST_CLAIM_ERROR_CODES.claimInProgress:
            return 'inProgress'
        case GUEST_CLAIM_ERROR_CODES.accountLimit:
            return 'accountLimit'
        case GUEST_CLAIM_ERROR_CODES.invalidSignature:
        case GUEST_CLAIM_ERROR_CODES.linkNotFound:
        case GUEST_CLAIM_ERROR_CODES.amountMismatch:
        case GUEST_CLAIM_ERROR_CODES.accountMismatch:
            return 'linkInvalid'
    }
    if (status === 403) return 'unsupported'
    return null
}
