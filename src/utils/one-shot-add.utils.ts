import type { FeatureSetupReport, KycIntentKey, KycIntentSet, KycIntentsSaved } from '@/services/kyc-intents'

const NO_INTENTS: KycIntentSet = { qr: false, local: false, card: false, bank: false }

/**
 * The stored set with one more feature (TASK-23329, D16). QR comes with every
 * check, so it stays ticked. A removed tick withdraws nothing, so nothing is
 * ever unticked here: an unknown stored set starts from none.
 */
export function addIntent(stored: KycIntentSet | null | undefined, feature: KycIntentKey): KycIntentSet {
    return { ...NO_INTENTS, ...stored, qr: true, [feature]: true }
}

/**
 * What the unlock sheet does with the PUT answer for the tapped feature.
 * - `on`: the method is already available; the sheet closes and the rows refresh
 * - `refused`: the sheet says why, with the reason's own line
 * - `pending`: the tick is saved and nothing is enabled yet (the API could not
 *   read the facts); the sheet says to check back, and the next save sets it up
 * - `setup`: the setup drawer shows the stored set; `report` fills the rows
 *   the rails say nothing about yet, and is null when the API ran no plan
 */
export type AddOutcome =
    | { kind: 'on' }
    | { kind: 'refused'; reason?: string }
    | { kind: 'pending' }
    | { kind: 'setup'; report: FeatureSetupReport | null }

export function addOutcome(saved: KycIntentsSaved, feature: KycIntentKey): AddOutcome {
    const entry = saved.features?.[feature]
    switch (entry?.state) {
        case 'on':
            return { kind: 'on' }
        case 'refused':
            return { kind: 'refused', ...(entry.reason ? { reason: entry.reason } : {}) }
        case 'pending':
            return { kind: 'pending' }
        default:
            // setting_up and action_required: the drawer shows the state; no
            // answer: the rails on /users/me do, as item 9a reads them
            return { kind: 'setup', report: saved.features ?? null }
    }
}
