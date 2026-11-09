import type { FeatureReportEntry, NextAction } from '@/types/capabilities'
import { RESIDENCE_ADDRESS_ACTION_KEY, RESIDENCE_ADDRESS_REJECTED_PURPOSE } from '@/constants/kyc.consts'

export type ResidenceAddressEntry = 'required' | 'rejected' | 'in_review' | 'unavailable'

/** Missing descriptors remain unresolved; they cannot grant access to a feature. */
export function residenceAddressEntry(
    entry: FeatureReportEntry | undefined,
    actions: readonly NextAction[]
): ResidenceAddressEntry | null {
    if (entry?.state === 'setting_up' && entry.reason === 'residence_address_in_review') return 'in_review'
    if (entry?.state === 'setting_up' && entry.reason === 'residence_unresolved') return 'unavailable'
    if (
        entry?.state !== 'action_required' ||
        (entry.action !== RESIDENCE_ADDRESS_ACTION_KEY && entry.reason !== 'residence_unresolved')
    )
        return null
    const action = actions.find(
        (candidate) =>
            candidate.key === entry.action &&
            candidate.key === RESIDENCE_ADDRESS_ACTION_KEY &&
            candidate.kind === 'sumsub' &&
            candidate.levelKey === 'address_of_residence'
    )
    if (!action) return 'unavailable'
    return action.purpose === RESIDENCE_ADDRESS_REJECTED_PURPOSE ? 'rejected' : 'required'
}
