export type WalletPlatform = 'ios' | 'android' | 'other'

/** The phone OS whose wallet (Apple Wallet or Google Wallet) the card goes into. */
export function walletPlatformFromUserAgent(userAgent: string): WalletPlatform {
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios'
    if (/Android/i.test(userAgent)) return 'android'
    return 'other'
}
