import {
    REJECT_ACTION_SEVERITY,
    REJECT_LABEL_ACTIONS,
    RETRY_ACTIONS,
    type RejectAction,
} from '@/constants/sumsub-reject-actions.consts'
import {
    FALLBACK_REJECT_LABEL_CODE,
    REJECT_LABEL_CODES,
    TERMINAL_REJECT_LABELS,
    type RejectLabelDisplayCode,
} from '@/constants/sumsub-reject-labels.consts'
import { identityRejection, profileIdentityRejection, rejectActionOf } from '@/utils/identity-rejection.utils'
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'

const EXPECTED: Record<RejectAction, string[]> = {
    retry_document: [
        'DOCUMENT_BAD_QUALITY',
        'LOW_QUALITY',
        'UNSATISFACTORY_PHOTOS',
        'DOCUMENT_DAMAGED',
        'DOCUMENT_INCOMPLETE',
        'INCOMPLETE_DOCUMENT',
        'DOCUMENT_PAGE_MISSING',
        'DOCUMENT_MISSING',
        'BLACK_AND_WHITE',
        'SCREENSHOTS',
        'DIGITAL_DOCUMENT',
        'DOCUMENT_EXPIRED',
        'EXPIRATION_DATE',
        'ID_INVALID',
        'UNSUPPORTED_DOCUMENT',
        'WRONG_DOCUMENT',
        'NOT_DOCUMENT',
        'DOCUMENT_TEMPLATE',
        'OUTDATED_DOCUMENT_VERSION',
        'UNFILLED_ID',
        'UNSUITABLE_DOCUMENT',
        'INCOMPATIBLE_LANGUAGE',
        'UNSUPPORTED_LANGUAGE',
        'BAD_PROOF_OF_IDENTITY',
        'BAD_PROOF_OF_ADDRESS',
        'BAD_PROOF_OF_PAYMENT',
        'ADDITIONAL_DOCUMENT_REQUIRED',
    ],
    retry_selfie: [
        'SELFIE_MISMATCH',
        'BAD_FACE_MATCHING',
        'BAD_SELFIE',
        'BAD_VIDEO_SELFIE',
        'SELFIE_BAD_QUALITY',
        'SELFIE_SPOOFING',
    ],
    check_details: [
        'PROBLEMATIC_APPLICANT_DATA',
        'WRONG_ADDRESS',
        'DB_DATA_MISMATCH',
        'DB_DATA_NOT_FOUND',
        'REQUESTED_DATA_MISMATCH',
        'GPS_AS_POA_SKIPPED',
    ],
    try_later: ['CHECK_UNAVAILABLE'],
    other_account: ['DUPLICATE', 'DUPLICATE_EMAIL'],
    contact_support: [
        'FRAUDULENT_LIVENESS',
        'DOCUMENT_FAKE',
        'FORGERY',
        'GRAPHIC_EDITOR',
        'GRAPHIC_EDITOR_USAGE',
        'FRAUDULENT_PATTERNS',
        'THIRD_PARTY_INVOLVED',
        'BLOCKLIST',
        'SPAM',
        'RESTRICTED_PERSON',
        'ADVERSE_MEDIA',
        'CRIMINAL',
        'COMPROMISED_PERSONS',
        'PEP',
        'SANCTIONS',
        'INCONSISTENT_PROFILE',
        FALLBACK_REJECT_LABEL_CODE,
    ],
    not_available: [
        'AGE_REQUIREMENT_MISMATCH',
        'AGE_BELOW_ACCEPTED_LIMIT',
        'REGULATIONS_VIOLATIONS',
        'WRONG_USER_REGION',
    ],
}

const expectedOf = (code: string) =>
    (Object.entries(EXPECTED) as [RejectAction, string[]][]).find(([, codes]) => codes.includes(code))?.[0]

describe('reject label actions', () => {
    it.each<RejectLabelDisplayCode>([...REJECT_LABEL_CODES, FALLBACK_REJECT_LABEL_CODE])(
        '%s has its action',
        (code) => {
            expect(REJECT_LABEL_ACTIONS[code]).toBe(expectedOf(code))
        }
    )

    it('maps nothing the label registry does not know', () => {
        const known = new Set<string>([...REJECT_LABEL_CODES, FALLBACK_REJECT_LABEL_CODE])
        expect(Object.keys(REJECT_LABEL_ACTIONS).filter((code) => !known.has(code))).toEqual([])
    })

    it('ranks every action once', () => {
        expect([...REJECT_ACTION_SEVERITY].sort()).toEqual(Object.keys(EXPECTED).sort())
    })

    it('never offers a self-serve retry for a terminal label', () => {
        for (const label of TERMINAL_REJECT_LABELS)
            expect(RETRY_ACTIONS.has(REJECT_LABEL_ACTIONS[label as keyof typeof REJECT_LABEL_ACTIONS])).toBe(false)
    })

    it.each([
        ['en', en],
        ['es-419', es419],
        ['pt-BR', ptBR],
    ] as const)('%s has copy for every action', (_, messages) => {
        const actions = messages.kyc.rejectActions as Record<string, Record<string, string>>
        for (const action of REJECT_ACTION_SEVERITY) expect(actions[action]?.description).toBeTruthy()
    })

    it('picks the most severe action across labels', () => {
        expect(rejectActionOf(['DOCUMENT_BAD_QUALITY', 'SELFIE_MISMATCH'])).toBe('retry_document')
        expect(rejectActionOf(['DOCUMENT_BAD_QUALITY', 'DUPLICATE'])).toBe('other_account')
        expect(rejectActionOf(['DUPLICATE', 'FORGERY'])).toBe('contact_support')
        expect(rejectActionOf(['SANCTIONS', 'AGE_BELOW_ACCEPTED_LIMIT'])).toBe('not_available')
        expect(rejectActionOf(['SOMETHING_NEW'])).toBe('contact_support')
        expect(rejectActionOf([])).toBeNull()
    })
})

describe('identityRejection', () => {
    it('offers the retry a retryable label asks for', () => {
        const rejection = identityRejection({ rejectLabels: ['SELFIE_BAD_QUALITY'], retryable: true })
        expect(rejection).toMatchObject({ action: 'retry_selfie', support: null, labels: ['SELFIE_BAD_QUALITY'] })
        expect(rejection.ctaKey).toBe('kyc.rejectActions.retry_selfie.cta')
    })

    it('sends a final decision on a retry-type label to support, without listing it', () => {
        const rejection = identityRejection({ rejectLabels: ['DOCUMENT_BAD_QUALITY'], retryable: false })
        expect(rejection).toMatchObject({ action: 'contact_support', labels: [] })
        expect(rejection.ctaKey).toBeUndefined()
        expect(rejection.support?.messageKey).toBe('kyc.rejectActions.contact_support.supportMessage')
    })

    it('never names a support-only cause', () => {
        const rejection = identityRejection({ rejectLabels: ['FORGERY', 'SANCTIONS'], retryable: false })
        expect(rejection.labels).toEqual([])
        expect(rejection.descriptionKey).toBe('kyc.rejectActions.contact_support.description')
    })

    it('a retryable check is not held on a support-only label', () => {
        expect(identityRejection({ rejectLabels: ['FORGERY'], retryable: true }).action).toBe('retry_document')
    })

    it('a duplicate offers the other account and a prefilled support case', () => {
        const rejection = identityRejection({ rejectLabels: ['DUPLICATE'], retryable: false })
        expect(rejection).toMatchObject({
            action: 'other_account',
            descriptionKey: 'kyc.rejectActions.other_account.description',
            ctaKey: 'kyc.rejectActions.other_account.cta',
            support: { code: 'duplicate_account', messageKey: 'kyc.rejectActions.other_account.supportMessage' },
        })
    })

    it('reads the API’s duplicate_account reason without labels', () => {
        expect(identityRejection({ reason: { code: 'duplicate_account' }, retryable: false }).action).toBe(
            'other_account'
        )
    })

    it('an email collision keeps its own copy and prefill', () => {
        const rejection = identityRejection({ rejectLabels: ['DUPLICATE_EMAIL'], retryable: true })
        expect(rejection.descriptionKey).toBe('identity.reasons.duplicate_account')
        expect(rejection.support?.messageKey).toBe('kyc.initiate.supportMessageDuplicateAccount')
    })

    it('a region decision explains itself and offers no support', () => {
        const rejection = identityRejection({ reason: { code: 'identity_region_restricted' }, retryable: false })
        expect(rejection).toMatchObject({ action: 'not_available', support: null })
        expect(rejection.ctaKey).toBeUndefined()
    })

    it('an age decision lists its reason and offers support for a review', () => {
        const rejection = identityRejection({ rejectLabels: ['AGE_BELOW_ACCEPTED_LIMIT'], retryable: false })
        expect(rejection).toMatchObject({ action: 'not_available', labels: ['AGE_BELOW_ACCEPTED_LIMIT'] })
        expect(rejection.support).not.toBeNull()
    })

    it('a retryable check without labels is tried again', () => {
        expect(identityRejection({ retryable: true })).toMatchObject({
            action: 'retry_document',
            ctaKey: 'kyc.paperworkVerification.failed.retry',
        })
    })

    it('reads retryability off the profile', () => {
        expect(profileIdentityRejection({ status: 'failed', rejectLabels: ['BAD_SELFIE'] }).action).toBe(
            'contact_support'
        )
        expect(
            profileIdentityRejection({ status: 'failed', canRetry: true, rejectLabels: ['BAD_SELFIE'] }).action
        ).toBe('retry_selfie')
        expect(
            profileIdentityRejection({ status: 'action_required', rejectType: 'FINAL', rejectLabels: ['BAD_SELFIE'] })
                .action
        ).toBe('contact_support')
    })
})
