import { createContext } from 'react'

// The words that ask the user to contact support, in en / es / pt. Inside an
// error Callout these words become the support link.
const CONTACT_SUPPORT_PHRASES = [
    String.raw`\b(?:contact|talk to|chat with|ask|reach|message|write to)\s+(?:our\s+)?support\b`,
    String.raw`\b(?:contact[aá]r?|habla(?:r)? con|chatear con|escr[ií]bele a|escribirle a|escribe a|ped[ií] a)\s+(?:(?:a|al|con)\s+)?(?:nuestro\s+)?soporte\b`,
    String.raw`\b(?:fal(?:e|ar)\s+com|contato\s+com|contat(?:e|ar)|pe[cç]a\s+ao)\s+(?:o\s+|nosso\s+)?suporte\b`,
]

export const CONTACT_SUPPORT_PHRASE = new RegExp(CONTACT_SUPPORT_PHRASES.join('|'), 'i')

// Asks the user to contact support. The bare word is not enough: "Peanut
// doesn't support recurring PIX" needs a new QR code, not support.
export const ASKS_FOR_SUPPORT = new RegExp(
    [
        ...CONTACT_SUPPORT_PHRASES,
        String.raw`\bsupport\s+(?:can|team)\b`,
        String.raw`\bsoporte\s+puede\b|\bequipo\s+de\s+soporte\b`,
        String.raw`\bsuporte\s+pode\b`,
    ].join('|'),
    'i'
)

/** Set by an error Callout that offers support: opens the support drawer. */
export const SupportAskContext = createContext<(() => void) | null>(null)
