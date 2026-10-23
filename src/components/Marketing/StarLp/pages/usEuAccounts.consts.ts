import type { StarLpPersonaCard } from '@/components/Marketing/StarLp/starLp.types'
import { STAR_LP_EARNERS } from '@/components/Marketing/StarLp/starLpPersonas.consts'
import type { UsEuStripTone } from './usEuAccounts.types'

/**
 * The persona fold's cards: who pays each earner and over which rail. Payers
 * follow the account rules in product/support-answers/deposit-accounts.md:
 * euros only from the earner or a business (agency, studio), dollars from a
 * business in any amount (employer, magazines). "Salary" and "Invoices" are the
 * How it works seam's own words.
 */
export const US_EU_PERSONA_CARDS: readonly StarLpPersonaCard[] = [
    { ...STAR_LP_EARNERS.designer, line: 'A Berlin agency pays me in euros.', tag: 'SEPA' },
    { ...STAR_LP_EARNERS.developer, line: 'My salary comes from a US employer.', tag: 'ACH' },
    { ...STAR_LP_EARNERS.writer, line: 'My clients are magazines in Chicago.', tag: 'ACH' },
    { ...STAR_LP_EARNERS.editor, line: 'A studio in Amsterdam pays my invoices.', tag: 'SEPA' },
]

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
