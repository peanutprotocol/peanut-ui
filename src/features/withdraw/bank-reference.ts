/**
 * The optional reference a user can send with a bank withdrawal.
 *
 * Each rail carries it in its own field, with its own limits, and the provider
 * refuses the whole transfer when the text breaks them — so the form checks the
 * same limits before anything is created. Limits are the provider's
 * (apidocs.bridge.xyz, create a transfer → destination).
 *
 * A rail with no entry takes no reference, and the field does not show:
 * - `faster_payments`: the API route accepts `fasterPaymentsReference` but does
 *   not pass it to the provider yet.
 * - `spei`, `co_bank_transfer`: the API route has no field for them.
 * - `wire`: no withdrawal uses it; US accounts pay out over `ach`.
 */
export interface BankReferenceSpec {
    /** The `destination` key of the create-offramp request that carries the text. */
    field: 'sepaReference' | 'achReference'
    minLength: number
    maxLength: number
    /** Matches a whole reference made of allowed characters only. */
    allowed: RegExp
    /** `withdraw.bank` message key that states the limits under the field. */
    helperKey: 'referenceHelperSepa' | 'referenceHelperAch'
    /** `withdraw.bank` message key that names the allowed characters. */
    invalidCharsKey: 'referenceInvalidCharsSepa' | 'referenceInvalidCharsAch'
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
