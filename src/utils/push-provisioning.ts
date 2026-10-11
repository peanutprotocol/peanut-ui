import { nativeCapability } from './native-capability'

/**
 * Independent PostHog launch gates. Keep each off until its platform approval
 * and provisioning flow are verified on a production binary.
 */
export const PUSH_PROVISIONING_FLAGS = {
    apple: 'push-provisioning-apple',
    google: 'push-provisioning-google',
} as const

export interface PushProvisioningAvailability {
    available: boolean
    alreadyInWallet: boolean
}

export interface AddCardToWalletArgs {
    /** Peanut's internal card UUID, used by Wallet extensions to fetch credentials. */
    peanutCardId?: string
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
    rememberCard(options: { peanutCardId: string; last4: string; displayName?: string }): Promise<void>
    setWalletAuthorizationToken(options: { cardId: string; token: string; expiresIn: number }): Promise<void>
    clearWalletSession(options: Record<string, never>): Promise<void>
    clearWalletLegacySession(options: Record<string, never>): Promise<void>
    clearWalletCard(options: Record<string, never>): Promise<void>
    clearWalletAuthorizationToken(options: Record<string, never>): Promise<void>
    clearWalletStateIfCardMatches(options: { cardId: string }): Promise<void>
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
 * Can this device do one-tap wallet provisioning? Omit last4 on Android:
 * its suffix lookup cannot distinguish cards with the same last four digits.
 * The native addCard flow checks the exact card before provisioning.
 * False on web, binaries without the SDK, or without required entitlements.
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

/** Mirror non-sensitive card metadata so Apple Wallet can discover the issuer. */
export async function rememberCardForWallet(card: {
    peanutCardId: string
    last4: string
    displayName?: string
}): Promise<void> {
    await PushProvisioning.call('rememberCard', card, () => undefined)
}

/** Keep the revocable, card-scoped credential used by direct Wallet launches. */
export async function syncWalletAuthorizationToken(cardId: string, token: string, expiresIn: number): Promise<void> {
    await PushProvisioning.call('setWalletAuthorizationToken', { cardId, token, expiresIn }, () => undefined)
}

/** Remove the Wallet extension's bearer credential and card metadata on logout. */
export async function clearWalletSession(): Promise<void> {
    await PushProvisioning.call('clearWalletSession', {}, () => undefined)
}

/** Remove only the legacy full-session item left by older app bundles. */
export async function clearLegacyWalletSessionForWallet(): Promise<void> {
    await PushProvisioning.call('clearWalletLegacySession', {}, () => undefined)
}

/** Remove only the discoverable card metadata when the rollout gate closes. */
export async function clearWalletCardForWallet(): Promise<void> {
    await PushProvisioning.call('clearWalletCard', {}, () => undefined)
}

/** Drop the direct Wallet credential when the rollout is disabled. */
export async function clearWalletAuthorizationToken(): Promise<void> {
    await PushProvisioning.call('clearWalletAuthorizationToken', {}, () => undefined)
}

/** Undo a stale async write without erasing a replacement card's Wallet state. */
export async function clearWalletStateIfCardMatches(cardId: string): Promise<void> {
    await PushProvisioning.call('clearWalletStateIfCardMatches', { cardId }, () => undefined)
}
