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
}

const SPECS: Record<string, BankReferenceSpec> = {
    sepa: {
        field: 'sepaReference',
        minLength: 6,
        maxLength: 140,
        allowed: /^[a-zA-Z0-9 &\-./]*$/,
        helperKey: 'referenceHelperSepa',
        invalidCharsKey: 'referenceInvalidCharsSepa',
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
 * Whose name the receiving bank shows as the sender of a withdrawal.
 *
 * It is not the user, on any rail we offer. The provider sets this per rail as
 * account configuration — we cannot set it per payment — so the honest thing is
 * to say what each rail actually does. Read from the provider's payout
 * configuration for our own account (2026-09-21):
 * - `sepa`: the provider's own entity. The user's name reaches the recipient
 *   only inside the reference line.
 * - `ach`: the provider's own entity, under a Peanut descriptor.
 * - `spei`: the provider's upstream local bank.
 * - `wire`: Peanut itself.
 *
 * `faster_payments` and `co_bank_transfer` are absent from that configuration,
 * so we do not know and say nothing rather than guess.
 */
export type PayoutSenderNoteKey = 'payoutSenderSepa' | 'payoutSenderAch' | 'payoutSenderSpei' | 'payoutSenderWire'

const SENDER_NOTES: Record<string, PayoutSenderNoteKey> = {
    sepa: 'payoutSenderSepa',
    ach: 'payoutSenderAch',
    spei: 'payoutSenderSpei',
    wire: 'payoutSenderWire',
}

/** The `withdraw.bank` message key for this rail, or null when we cannot say. */
export function payoutSenderNoteForRail(paymentRail: string | undefined): PayoutSenderNoteKey | null {
    return (paymentRail && SENDER_NOTES[paymentRail]) || null
}
