import { nativeCapability } from './native-capability'

/**
 * PostHog launch gate for native wallet push provisioning (doctrine:
 * feature-gates.md). Stays off in prod until the Apple entitlement / Google
 * onboarding land and the flow is verified on production binaries.
 */
export const PUSH_PROVISIONING_FLAG = 'push-provisioning'

export interface PushProvisioningAvailability {
    available: boolean
    alreadyInWallet: boolean
}

export interface AddCardToWalletArgs {
    cardId: string
    cardSecret: string
    cardholderName?: string
    last4?: string
    displayName?: string
    address?: {
        line1: string
        line2?: string
        city: string
        region: string
        postalCode: string
        countryCode: string
    }
}

export interface AddCardToWalletResult {
    added: boolean
    canceled?: boolean
    alreadyInWallet?: boolean
    error?: string
    last4?: string
}

interface PushProvisioningPlugin {
    isAvailable(options: { last4?: string }): Promise<PushProvisioningAvailability>
    addCard(options: AddCardToWalletArgs): Promise<AddCardToWalletResult>
}

// App-local plugin (ios/App/App/PushProvisioningPlugin.swift, android
// src/meawallet/java). Binaries built without the MeaWallet SDK — and OTA'd JS
// on older binaries — don't have it, so every caller treats "unavailable" as
// false and falls back to the manual add-to-wallet carousel.
const PushProvisioning = nativeCapability<PushProvisioningPlugin>('PushProvisioning', {
    platforms: ['ios', 'android'],
})

/**
 * Can this device do one-tap wallet provisioning for this card? False on web,
 * on binaries without the MeaWallet SDK, before the Apple entitlement is
 * granted, and when the card is already in the wallet — exactly the cases
 * where the UI should keep the manual carousel (or hide the row).
 */
export async function getPushProvisioningAvailability(last4?: string): Promise<PushProvisioningAvailability> {
    return PushProvisioning.call('isAvailable', { last4 }, () => ({ available: false, alreadyInWallet: false }))
}

/**
 * Run the native add-to-wallet flow (Apple Pay sheet / Google Pay tokenization).
 * Never throws: failures come back as `{ added: false, error }` so the caller
 * can toast + report without a try/catch at every call site.
 */
export async function addCardToWallet(args: AddCardToWalletArgs): Promise<AddCardToWalletResult> {
    return PushProvisioning.call('addCard', args, (error) => ({
        added: false,
        error: error instanceof Error ? error.message : 'unavailable',
    }))
}
