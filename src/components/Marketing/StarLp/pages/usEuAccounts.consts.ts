import type { UsEuStripTone } from './usEuAccounts.types'

/** The client's SEPA transfer in How it works, in euros. */
export const US_EU_EUR_IN = 1500

/** Fulano's EUR account as the hero capture masks it (fixture IBAN DE89 3704 0044 0532 0130 00). */
export const US_EU_IBAN_MASKED = 'DE89 •••• •••• 0130 00'

/** The sky fold's CTA: make a request link (signed in: straight to /request). */
export const US_EU_REQUEST_HREF = {
    guest: `/setup?redirect_uri=${encodeURIComponent('/request')}`,
    signedIn: '/request',
} as const

/** Strip ground and disc ground per tone. */
export const US_EU_STRIP_TONE: Record<UsEuStripTone, { strip: string; disc: string }> = {
    white: { strip: 'bg-background-default', disc: 'bg-background-brand' },
    pink: { strip: 'bg-background-brand', disc: 'bg-background-default' },
    green: { strip: 'bg-background-badge-success', disc: 'bg-background-brand' },
}
