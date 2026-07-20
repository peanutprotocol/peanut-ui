import { apiFetch } from '@/utils/api-fetch'
import { LEGAL_DOCUMENT_VERSIONS, type LegalDocumentSlug } from '@/constants/legal-versions.generated'

/**
 * Consent ledger (tos-v1 phase 2). Every acceptance surface echoes the
 * documents it actually displayed — slug + version (frontmatter last_updated)
 * + sha256 of the en.md — so peanut-api's append-only `consent_records` table
 * stores what the user was shown, not what either side assumes.
 */

export interface AcceptedLegalDocument {
    slug: string
    version: string
    hash: string
}

export interface ConsentStatusDocument {
    slug: string
    currentVersion: string
    acceptedVersion: string | null
    acceptedAt: string | null
    needsAcceptance: boolean
}

export interface ConsentStatusResponse {
    documents: ConsentStatusDocument[]
    needsReConsent: boolean
}

export const acceptedLegalDocument = (slug: LegalDocumentSlug): AcceptedLegalDocument => ({
    slug,
    version: LEGAL_DOCUMENT_VERSIONS[slug].version,
    hash: LEGAL_DOCUMENT_VERSIONS[slug].hash,
})

/** Documents the signup screen presents ("By creating account you agree with…"). */
export const signupConsentDocuments = (): AcceptedLegalDocument[] => [
    acceptedLegalDocument('terms'),
    acceptedLegalDocument('privacy'),
]

/** Peanut-owned documents the card agreement screen presents (CardTermsScreen);
 *  the third-party Issuer Privacy Policy has no slug of ours and is not ledgered. */
export const cardConsentDocuments = (isUsResident: boolean): AcceptedLegalDocument[] =>
    isUsResident
        ? [
              acceptedLegalDocument('card-terms-us'),
              acceptedLegalDocument('card-esign'),
              acceptedLegalDocument('card-privacy'),
          ]
        : [acceptedLegalDocument('card-terms-international'), acceptedLegalDocument('card-esign')]

export const consentApi = {
    getStatus: async (): Promise<ConsentStatusResponse> => {
        const response = await apiFetch('/users/consent/status', { method: 'GET' })
        if (!response.ok) throw new Error(`Failed to load consent status (${response.status})`)
        return await response.json()
    },

    accept: async (documents: AcceptedLegalDocument[]): Promise<{ recorded: number }> => {
        const response = await apiFetch('/users/consent/accept', {
            method: 'POST',
            body: JSON.stringify({ documents }),
        })
        if (!response.ok) throw new Error(`Failed to record acceptance (${response.status})`)
        return await response.json()
    },
}
