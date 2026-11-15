import { isCapacitor } from '@/utils/capacitor'

const inAppSignatures = [
    // Do not use generic "WebView" or "Android.*wv" signatures: those also
    // match Peanut's supported Capacitor shell. Keep this list to known
    // third-party in-app browsers that cannot reliably complete passkeys.
    '(iPhone|iPod|iPad)(?!.*Safari\\/)',
    'FBAN',
    'FBAV',
    'Instagram',
    'Twitter',
    'Snapchat',
    'Line',
    'WhatsApp',
    'WeChat',
    'TelegramBot',
    'Telegram',
    'TelegramWebApp',
    'Puffin',
    'Discord',
    'TikTok',
    'Messenger',
    'Viber',
    'Reddit',
    'Pinterest',
    'LinkedInApp',
    'SnapKit',
    'Electron',
]

// checks user agent against a list of known in-app browser signatures
export const isLikelyWebview = (): boolean => {
    if (typeof navigator === 'undefined') return false
    // capacitor webview is intentional — not an in-app browser
    if (isCapacitor()) return false
    const uaString = navigator.userAgent || navigator.vendor || (window as { opera?: string }).opera || ''
    return inAppSignatures.some((sig) => new RegExp(sig, 'i').test(uaString))
}
