import { IDENTITY_REGION_RESTRICTED_CODE } from '@/constants/kyc.consts'
import {
    REJECT_ACTION_SEVERITY,
    REJECT_LABEL_ACTIONS,
    RETRY_ACTIONS,
    type RejectAction,
} from '@/constants/sumsub-reject-actions.consts'
import {
    FALLBACK_REJECT_LABEL_CODE,
    isTerminalRejection,
    rejectLabelCode,
    type RejectLabelDisplayCode,
} from '@/constants/sumsub-reject-labels.consts'
import type { CapabilityReason, IdentityVerification } from '@/types/capabilities'
import { buildContactSupportMessage } from '@/utils/contact-support.utils'
import { DUPLICATE_ACCOUNT_REASON_CODE, IMPORTED_IDENTITY_REJECTED_CODE } from '@/utils/capability-gate'

const IDENTITY_REJECTED_CODE = 'identity_rejected'

/** Catalog keys are read from the root namespace (`useTranslations()`). */
export interface IdentityRejection {
    action: RejectAction
    /** why it failed and what to do, in one line */
    descriptionKey: string
    /** the button that takes the action; absent when support or Home is the only way on */
    ctaKey?: string
    /** labels whose own explanation fits the action, for RejectLabelsList */
    labels: RejectLabelDisplayCode[]
    /** a prefilled support conversation, or null where support cannot change the outcome */
    support: { messageKey: string; code: string } | null
}

const SUPPORT = (code: string, messageKey = 'kyc.rejectActions.contact_support.supportMessage') => ({
    messageKey,
    code,
})

/** The action a set of labels calls for: the most severe one any label maps to. */
export function rejectActionOf(labels: readonly string[]): RejectAction | null {
    const actions = new Set(labels.map((label) => REJECT_LABEL_ACTIONS[rejectLabelCode(label)]))
    return REJECT_ACTION_SEVERITY.find((action) => actions.has(action)) ?? null
}

/**
 * How a rejected identity is explained and what it is offered, the same on
 * every surface. A retry is offered only while `retryable`: a final decision
 * on a retry-type label goes to support. Causes only a person can review are
 * never named, so their labels are not listed.
 */
export function identityRejection({
    rejectLabels,
    reason,
    retryable,
}: {
    rejectLabels?: readonly string[] | null
    reason?: Partial<CapabilityReason> | null
    retryable: boolean
}): IdentityRejection {
    const labels = [...new Set((rejectLabels ?? []).map(rejectLabelCode))]
    const known = labels.filter((label) => label !== FALLBACK_REJECT_LABEL_CODE)

    if (reason?.code === IDENTITY_REGION_RESTRICTED_CODE)
        return {
            action: 'not_available',
            descriptionKey: 'identity.reasons.identity_region_restricted',
            labels: [],
            support: null,
        }
    if (reason?.code === IMPORTED_IDENTITY_REJECTED_CODE)
        return {
            action: 'contact_support',
            descriptionKey: 'identity.reasons.imported_identity_rejected',
            labels: [],
            support: SUPPORT(IMPORTED_IDENTITY_REJECTED_CODE, 'kyc.initiate.supportMessageImportedIdentity'),
        }

    // A check that can still pass is not held on a support-only label: an explicit retry outranks it.
    const fromLabels = rejectActionOf(
        retryable ? known.filter((label) => REJECT_LABEL_ACTIONS[label] !== 'contact_support') : known
    )
    const severest = REJECT_ACTION_SEVERITY.find(
        (action) =>
            action === fromLabels || (action === 'other_account' && reason?.code === DUPLICATE_ACCOUNT_REASON_CODE)
    )
    // No label we can read: a check that can pass is tried again, a decision goes to support.
    const wanted = severest ?? (retryable ? 'retry_document' : 'contact_support')
    const action: RejectAction = !retryable && RETRY_ACTIONS.has(wanted) ? 'contact_support' : wanted
    const explained = known.filter((label) => {
        const own = REJECT_LABEL_ACTIONS[label]
        if (own === 'contact_support' || own === 'other_account') return false
        return retryable || !RETRY_ACTIONS.has(own)
    })

    switch (action) {
        case 'other_account': {
            // The API names Sumsub's duplicate only with its DUPLICATE label; without it, the account shares an email.
            const emailOnly = !labels.includes('DUPLICATE')
            return {
                action,
                descriptionKey: emailOnly
                    ? 'identity.reasons.duplicate_account'
                    : 'kyc.rejectActions.other_account.description',
                ctaKey: 'kyc.rejectActions.other_account.cta',
                labels: explained,
                support: SUPPORT(
                    DUPLICATE_ACCOUNT_REASON_CODE,
                    emailOnly
                        ? 'kyc.initiate.supportMessageDuplicateAccount'
                        : 'kyc.rejectActions.other_account.supportMessage'
                ),
            }
        }
        case 'contact_support':
        case 'not_available':
            return {
                action,
                descriptionKey: `kyc.rejectActions.${action}.description`,
                labels: explained,
                support: SUPPORT(reason?.code ?? IDENTITY_REJECTED_CODE),
            }
        case 'retry_selfie':
        case 'check_details':
            return {
                action,
                descriptionKey: `kyc.rejectActions.${action}.description`,
                ctaKey: `kyc.rejectActions.${action}.cta`,
                labels: explained,
                support: null,
            }
        default:
            return {
                action,
                descriptionKey: `kyc.rejectActions.${action}.description`,
                ctaKey: 'kyc.paperworkVerification.failed.retry',
                labels: explained,
                support: null,
            }
    }
}

/** A failed identity read off the profile: final unless the API says a new attempt can pass. */
export function profileIdentityRejection(identity: IdentityVerification): IdentityRejection {
    return identityRejection({
        rejectLabels: identity.rejectLabels,
        reason: identity.reason,
        retryable:
            identity.status === 'failed'
                ? identity.canRetry === true
                : !isTerminalRejection({ rejectType: identity.rejectType, rejectLabels: identity.rejectLabels }),
    })
}

/** The support prefill for a rejection, in the user's words (`message`, already translated). */
export function rejectionSupportMessage(
    support: NonNullable<IdentityRejection['support']>,
    message: string,
    reason?: Partial<CapabilityReason> | null,
    userId?: string
): string {
    return buildContactSupportMessage({
        reason: { details: reason?.details, code: support.code, userMessage: message },
        userId,
    })
}
