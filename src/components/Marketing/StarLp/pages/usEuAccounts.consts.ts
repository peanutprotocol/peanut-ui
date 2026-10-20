import type { CloudConfig } from '@/components/LandingPage/CloudsCss'

/** Fulano's EUR account as the hero capture masks it (fixture IBAN DE89 3704 0044 0532 0130 00). */
export const US_EU_IBAN_MASKED = 'DE89 •••• •••• 0130 00'

/** The sky fold's CTA: make a request link (signed in: straight to /request). */
export const US_EU_REQUEST_HREF = {
    guest: `/setup?redirect_uri=${encodeURIComponent('/request')}`,
    signedIn: '/request',
} as const

/** Two drifting clouds in the sky fold (peanut.me's CloudsCss), so the chat stays the focus. */
export const US_EU_SKY_CLOUDS = [
    { top: '18%', width: 180, speed: '38s', direction: 'ltr' },
    { top: '70%', width: 200, speed: '34s', direction: 'rtl' },
] as const satisfies CloudConfig[]
