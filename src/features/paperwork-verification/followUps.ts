import type { FeatureReport, NextAction } from '@/types/capabilities'
import { isBridgeDocumentTask, isCardDocumentTask, reportTasks, selectVerifyTasks } from '@/utils/bridge-tasks.utils'
import type { FollowUpLabel } from './components/StepsScreen'

/** A step a feature still asks for once the identity is verified, as the verified timeline shows it. */
export interface FollowUpStep {
    label: FollowUpLabel
    /** the sentence Home's task card says about it, under the timeline's title */
    note:
        | 'home.pendingTasks.cardAddressDescription'
        | 'home.pendingTasks.cardIdentityDescription'
        | 'home.pendingTasks.tosDescription'
        | 'home.pendingTasks.verifyDescription'
        | 'kyc.setup.documentDescription'
    href: string
}

/**
 * Where each step is done: the card's on /card, which holds the upload; a bank's on
 * Home, whose task card runs its flow (the document, the terms, the partner's own check).
 */
export function followUpStep(task: NextAction): FollowUpStep {
    if (isCardDocumentTask(task)) {
        const identity = task.kind === 'rain-hosted' || task.kind === 'restart-identity'
        return identity
            ? { label: 'cardIdentity', note: 'home.pendingTasks.cardIdentityDescription', href: '/card' }
            : { label: 'cardAddress', note: 'home.pendingTasks.cardAddressDescription', href: '/card' }
    }
    if (task.kind === 'accept-tos')
        return { label: 'bankTerms', note: 'home.pendingTasks.tosDescription', href: '/home' }
    if (task.kind === 'sumsub') return { label: 'bankDocument', note: 'kyc.setup.documentDescription', href: '/home' }
    return { label: 'bankCheck', note: 'home.pendingTasks.verifyDescription', href: '/home' }
}

/**
 * The steps still between the verified identity and its payments: Home's tasks whose feature
 * waits on them. A request on a feature that is on (Bridge's terms, its own check or a document,
 * due by a date) keeps a working rail working and unlocks nothing, so Home carries it and the
 * timeline does not: "Unlock eligible payments" stays done (Chip, ui#3913). Once such a request
 * falls due, its feature waits on it again and it is a step.
 */
export function verifiedFollowUps(nextActions: NextAction[], report: FeatureReport | undefined): FollowUpStep[] {
    const waitingBankKeys = new Set(
        reportTasks(report, nextActions)
            .filter(
                ({ feature, entry }) => (feature === 'bank' || feature === 'local') && entry.state === 'action_required'
            )
            .map(({ action }) => action.key)
    )
    return (
        selectVerifyTasks(nextActions, report)
            // the card's and the bank documents' tasks are picked from waiting features only
            .filter((task) => isCardDocumentTask(task) || isBridgeDocumentTask(task) || waitingBankKeys.has(task.key))
            .map(followUpStep)
    )
}
