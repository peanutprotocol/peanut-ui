/**
 * The optional reference a user can send with a bank withdrawal.
 *
 * Each rail carries it in its own field, with its own limits, and the provider
 * refuses the whole transfer when the text breaks them — so the form checks the
 * same limits before anything is created. Limits are the provider's
 * (apidocs.bridge.xyz, create a transfer → destination).
 *
 * A rail with no entry takes no reference, and the field does not show:
 * - `wire`: no withdrawal uses it; US accounts pay out over `ach`.
 *
 * SEPA and ACH limits are confirmed against the provider's sandbox. The other
 * three are documentation only: the provider states a length for SPEI (40) and
 * Colombia (18) and none for Faster Payments, and documents no character set
 * for any of the three. Those character sets are ours, chosen to match what the
 * banks on each rail print. Verify each on staging before trusting it.
 */
export interface BankReferenceSpec {
    /** The `destination` key of the create-offramp request that carries the text. */
    field: 'sepaReference' | 'achReference' | 'fasterPaymentsReference' | 'speiReference' | 'coBankTransferReference'
    minLength: number
    maxLength: number
    /** Matches a whole reference made of allowed characters only. */
    allowed: RegExp
    /** `withdraw.bank` message key that states the limits under the field. */
    helperKey:
        | 'referenceHelperSepa'
        | 'referenceHelperAch'
        | 'referenceHelperFasterPayments'
        | 'referenceHelperSpei'
        | 'referenceHelperCoBankTransfer'
    /** `withdraw.bank` message key that names the allowed characters. */
    invalidCharsKey: 'referenceInvalidCharsSepa' | 'referenceInvalidCharsAch' | 'referenceInvalidCharsSpei'
    /**
     * `withdraw.bank` key warning that the rail rewrites the text.
     *
     * Set only where we have seen it happen. On SEPA the spec allows a space
     * and the provider still strips it and capitalises the result
     * ("hello world" arrives as "Helloworld"), measured on a real transfer
     * 2026-09-21. We do not echo the final value back at submit time, so the
     * receipt's reference row is where the user reads what was really sent.
     */
    rewrittenKey?: 'referenceFormattingMayChange'
}

const SPECS: Record<string, BankReferenceSpec> = {
    sepa: {
        field: 'sepaReference',
        minLength: 6,
        maxLength: 140,
        allowed: /^[a-zA-Z0-9 &\-./]*$/,
        helperKey: 'referenceHelperSepa',
        invalidCharsKey: 'referenceInvalidCharsSepa',
        rewrittenKey: 'referenceFormattingMayChange',
    },
    ach: {
        field: 'achReference',
        minLength: 1,
        maxLength: 10,
        allowed: /^[a-zA-Z0-9 ]*$/,
        helperKey: 'referenceHelperAch',
        invalidCharsKey: 'referenceInvalidCharsAch',
    },
    faster_payments: {
        field: 'fasterPaymentsReference',
        minLength: 1,
        maxLength: 18,
        allowed: /^[a-zA-Z0-9 &\-./]*$/,
        helperKey: 'referenceHelperFasterPayments',
        invalidCharsKey: 'referenceInvalidCharsSepa',
    },
    spei: {
        field: 'speiReference',
        minLength: 1,
        maxLength: 40,
        allowed: /^[a-zA-Z0-9 ]*$/,
        helperKey: 'referenceHelperSpei',
        invalidCharsKey: 'referenceInvalidCharsSpei',
    },
    co_bank_transfer: {
        field: 'coBankTransferReference',
        minLength: 1,
        maxLength: 18,
        allowed: /^[a-zA-Z0-9 &\-./]*$/,
        helperKey: 'referenceHelperCoBankTransfer',
        invalidCharsKey: 'referenceInvalidCharsSepa',
    },
}

export function bankReferenceSpecForRail(paymentRail: string | undefined): BankReferenceSpec | null {
    return (paymentRail && SPECS[paymentRail]) || null
}

export type BankReferenceProblem = 'tooShort' | 'tooLong' | 'invalidChars'

/** The first limit the reference breaks, or null. An empty reference is valid: the field is optional. */
export function bankReferenceProblem(reference: string, spec: BankReferenceSpec): BankReferenceProblem | null {
    const text = reference.trim()
    if (!text) return null
    if (!spec.allowed.test(text)) return 'invalidChars'
    if (text.length < spec.minLength) return 'tooShort'
    if (text.length > spec.maxLength) return 'tooLong'
    return null
}

/**
 * The `destination` fields that carry this reference on this rail. Empty when
 * there is no reference, the rail takes none, or the text breaks the rail's
 * limits — an invalid reference must never reach the provider, where it fails
 * the transfer.
 */
export function bankReferenceDestinationFields(
    paymentRail: string | undefined,
    reference: string
): Partial<Record<BankReferenceSpec['field'], string>> {
    const spec = bankReferenceSpecForRail(paymentRail)
    const text = reference.trim()
    if (!spec || !text || bankReferenceProblem(text, spec)) return {}
    return { [spec.field]: text }
}

/**
 * The note under the review screen's amount block.
 *
 * Two different facts share one slot, because only one of them is true per
 * rail.
 *
 * On `sepa` we no longer say who the recipient's bank shows as the sender. Our
 * own round trip contradicts the old claim: a real SEPA payout landed with the
 * user's own legal name as `sender_name`, not our payment partner's. That
 * payout went into the user's own euro account at the same provider, so it is
 * not proof of what an unrelated bank records either — which is exactly why we
 * say nothing about the sender there. What we DID measure is what the
 * reference does, so that is what the note states.
 *
 * On the other rails the sender fact is read from the provider's payout
 * configuration for our own account (2026-09-21) and is unchanged:
 * - `ach`: the provider's own entity, under a Peanut descriptor.
 * - `spei`: the provider's upstream local bank.
 * - `wire`: Peanut itself.
 *
 * `faster_payments` and `co_bank_transfer` are absent from that configuration,
 * so we do not know and say nothing rather than guess.
 */
export type PayoutSenderNoteKey = 'payoutSenderAch' | 'payoutSenderSpei' | 'payoutSenderWire'
export type PayoutReferenceNoteKey = 'payoutReferenceReplacesDefaultSepa'
export type PayoutNoteKey = PayoutSenderNoteKey | PayoutReferenceNoteKey

const PAYOUT_NOTES: Record<string, PayoutNoteKey> = {
    sepa: 'payoutReferenceReplacesDefaultSepa',
    ach: 'payoutSenderAch',
    spei: 'payoutSenderSpei',
    wire: 'payoutSenderWire',
}

/** The `withdraw.bank` message key for this rail, or null when we cannot say. */
export function payoutNoteForRail(paymentRail: string | undefined): PayoutNoteKey | null {
    return (paymentRail && PAYOUT_NOTES[paymentRail]) || null
}

/**
 * The extra sentence that holds only while the user has typed no reference.
 *
 * On `sepa` the default reference our payment partner composes carries the
 * user's legal name. A reference the user types replaces that whole line —
 * measured on a real transfer, 2026-09-21 (TD-37) — so the sentence goes as
 * soon as they type one, and the note above it says what they gave up.
 */
export type PayoutDefaultReferenceNoteKey = 'payoutDefaultReferenceCarriesNameSepa'

const DEFAULT_REFERENCE_NOTES: Record<string, PayoutDefaultReferenceNoteKey> = {
    sepa: 'payoutDefaultReferenceCarriesNameSepa',
}

/** The `withdraw.bank` key for this rail's default-reference sentence, or null. */
export function payoutDefaultReferenceNoteForRail(
    paymentRail: string | undefined
): PayoutDefaultReferenceNoteKey | null {
    return (paymentRail && DEFAULT_REFERENCE_NOTES[paymentRail]) || null
}
