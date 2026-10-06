const BRIDGE_LEGAL_URL = 'https://www.bridge.xyz/legal'

// Bridge contracts through a different entity per residence, each with its own
// User Terms and Privacy Policy (https://www.bridge.xyz/legal/overview).
const BRIDGE_TERMS_DOCUMENTS = {
    us: {
        terms: `${BRIDGE_LEGAL_URL}/us-terms/bridge-building-inc`,
        privacy: `${BRIDGE_LEGAL_URL}/us-privacy-policy/bridge-building-inc`,
    },
    eea: {
        terms: `${BRIDGE_LEGAL_URL}/eea-user-terms/bridge-building-s-a`,
        privacy: `${BRIDGE_LEGAL_URL}/eea-privacy-policy/bridge-building-s-a`,
    },
    restOfWorld: {
        terms: `${BRIDGE_LEGAL_URL}/row-user-terms/bridge-building-limited`,
        privacy: `${BRIDGE_LEGAL_URL}/row-privacy-policy/bridge-building-limited`,
    },
}

// Bridge's overview page says which documents apply to which residence and
// links all of them.
const BRIDGE_TERMS_OVERVIEW = {
    terms: `${BRIDGE_LEGAL_URL}/overview`,
    privacy: `${BRIDGE_LEGAL_URL}/overview`,
}

const EEA_ISO2 = new Set([
    'AT',
    'BE',
    'BG',
    'HR',
    'CY',
    'CZ',
    'DK',
    'EE',
    'FI',
    'FR',
    'DE',
    'GR',
    'HU',
    'IE',
    'IT',
    'LV',
    'LT',
    'LU',
    'MT',
    'NL',
    'PL',
    'PT',
    'RO',
    'SK',
    'SI',
    'ES',
    'SE',
    'IS',
    'LI',
    'NO',
])

// Bridge applies the EEA documents to the EEA "plus associated principalities
// and territories" and does not list them. The microstates and the EU
// territories that carry their own country code get the overview.
const EEA_ASSOCIATED_ISO2 = new Set(['AD', 'MC', 'SM', 'VA', 'AX', 'GF', 'GP', 'MQ', 'RE', 'YT', 'MF'])

export type BridgeEntity = keyof typeof BRIDGE_TERMS_DOCUMENTS

/**
 * The Bridge entity that contracts with a resident of `residenceIso2`, or null
 * with no residence or one Bridge does not place.
 */
export function bridgeEntityForResidence(residenceIso2: string | null | undefined): BridgeEntity | null {
    const iso2 = residenceIso2?.toUpperCase()
    if (!iso2 || EEA_ASSOCIATED_ISO2.has(iso2)) return null
    if (iso2 === 'US') return 'us'
    if (EEA_ISO2.has(iso2)) return 'eea'
    return 'restOfWorld'
}

/**
 * The Bridge Terms of Service and Privacy Policy that apply to a resident of
 * `residenceIso2`. With no residence, or one Bridge does not place, both links
 * go to Bridge's overview page instead of a document that may not apply.
 */
export function bridgeTermsDocuments(residenceIso2: string | null | undefined): { terms: string; privacy: string } {
    const entity = bridgeEntityForResidence(residenceIso2)
    return entity ? BRIDGE_TERMS_DOCUMENTS[entity] : BRIDGE_TERMS_OVERVIEW
}
