import { QrKycState } from '@/constants/kyc.consts'
import { qrPayIsAPath } from '@/features/payments/flows/qr-pay/qrKycGate.utils'

/** The cards that replace the checklist when a door is shut (region refused, provider rejection). */
export type BlockedCardKind =
    | 'region-restricted'
    | 'add-email'
    | 'complete-setup'
    | 'restart-identity'
    | 'verification-issue'

/**
 * A blocked card's dismissal key: its kind plus the reason code. A new reason
 * (another verdict or code) is a new key, so the card shows again once.
 */
export function blockedCardCtaId(kind: BlockedCardKind, reasonCode: string | null | undefined): string {
    return `blocked-card:${kind}:${reasonCode ?? 'none'}`
}

/**
 * A carousel slide that asks the user to verify ("Unlock QR code payments")
 * shows only to a user whose identity is not verified, and only when verifying
 * can open QR pay: the QR-pay gate says QR is a path but not yet open. Never
 * for a refused region or a blocked provider, where the ID check leads
 * nowhere, and never while the user is already mid-flow. "Verified" is the
 * identity status itself (the checklist's Verify row reads the same), not a
 * provider rail: a verified user with no pool rail must not be asked again.
 */
export function showVerifyCTA(input: {
    qrGateState: QrKycState
    isIdentityVerified: boolean
    isInFlight: boolean
    isCardEligible: boolean | undefined
}): boolean {
    return (
        qrPayIsAPath(input.qrGateState) === true &&
        input.qrGateState !== QrKycState.PROCEED_TO_PAY &&
        !input.isIdentityVerified &&
        !input.isInFlight &&
        // card-eligible users verify through the card flow instead
        input.isCardEligible === false
    )
}
