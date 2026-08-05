/**
 * Consent echo helpers — the doc sets each acceptance surface ledgers.
 *
 * Silent drift here mis-records legal consent (a user shown the international
 * card terms must never be ledgered as accepting the US ones), so the exact
 * slug sets are pinned, and every entry must carry the generated version+hash
 * for its own slug.
 */
jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))

import { signupConsentDocuments, cardConsentDocuments } from '../consent'
import { LEGAL_DOCUMENT_VERSIONS, type LegalDocumentSlug } from '@/constants/legal-versions.generated'

const expectEntriesMatchGenerated = (docs: { slug: string; version: string; hash: string }[]) => {
    for (const doc of docs) {
        const generated = LEGAL_DOCUMENT_VERSIONS[doc.slug as LegalDocumentSlug]
        expect(generated).toBeDefined()
        expect(doc.version).toBe(generated.version)
        expect(doc.hash).toBe(generated.hash)
    }
}

describe('signupConsentDocuments', () => {
    it('echoes exactly terms + privacy, with the generated version and hash', () => {
        const docs = signupConsentDocuments()
        expect(docs.map((d) => d.slug)).toEqual(['terms', 'privacy'])
        expectEntriesMatchGenerated(docs)
    })
})

describe('cardConsentDocuments', () => {
    it('US residents: card-terms-us + card-esign + card-privacy', () => {
        const docs = cardConsentDocuments(true)
        expect(docs.map((d) => d.slug)).toEqual(['card-terms-us', 'card-esign', 'card-privacy'])
        expectEntriesMatchGenerated(docs)
    })

    it('international residents: card-terms-international + card-esign — and never the US terms', () => {
        const docs = cardConsentDocuments(false)
        expect(docs.map((d) => d.slug)).toEqual(['card-terms-international', 'card-esign'])
        expectEntriesMatchGenerated(docs)
    })
})
